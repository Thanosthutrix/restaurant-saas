import "server-only";

import type Stripe from "stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyAdminPaymentFailed } from "@/lib/billing/notifyPaymentFailed";
import { createSubscriptionSignupEntitlement } from "@/lib/pro/signupEntitlementDb";
import { handleRestaurantAccessLost } from "@/lib/platform/publicListingAccess";
import {
  clearPaymentFailed,
  getSubscriptionByStripeCustomerId,
  getSubscriptionByStripeSubscriptionId,
  markPaymentFailed,
  syncSubscriptionFromStripe,
  upsertSubscriptionRow,
} from "@/lib/billing/subscriptionDb";

async function resolveRestaurantIdFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = subscription.metadata?.restaurant_id;
  if (fromMeta) return fromMeta;

  const existing = await getSubscriptionByStripeSubscriptionId(subscription.id);
  if (existing) return existing.restaurant_id;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (customerId) {
    const byCustomer = await getSubscriptionByStripeCustomerId(customerId);
    if (byCustomer) return byCustomer.restaurant_id;
  }

  return null;
}

async function notifyFailureForRestaurant(restaurantId: string, status?: string): Promise<void> {
  const { data: rest } = await supabaseServer
    .from("restaurants")
    .select("name, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!rest) return;

  let ownerEmail: string | null = null;
  if (rest.owner_id) {
    const { data } = await supabaseServer.auth.admin.getUserById(rest.owner_id as string);
    ownerEmail = data?.user?.email ?? null;
  }

  await notifyAdminPaymentFailed({
    restaurantId,
    restaurantName: rest.name as string,
    ownerEmail,
    status,
  });
}

export async function handleStripeCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const signupFlow = session.metadata?.signup_flow;
  const ownerUserId = session.metadata?.owner_user_id;
  const restaurantId = session.metadata?.restaurant_id;

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  if (signupFlow === "pre_restaurant" && ownerUserId) {
    await createSubscriptionSignupEntitlement({
      userId: ownerUserId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });
    return;
  }

  if (!restaurantId) return;

  await upsertSubscriptionRow({
    restaurant_id: restaurantId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status: "active",
  });
}

export async function handleStripeSubscriptionEvent(subscription: Stripe.Subscription): Promise<void> {
  const restaurantId = await resolveRestaurantIdFromSubscription(subscription);
  if (!restaurantId) {
    console.warn("[stripe/webhook] subscription sans restaurant_id:", subscription.id);
    return;
  }

  await syncSubscriptionFromStripe(subscription, restaurantId);

  if (subscription.status === "active" || subscription.status === "trialing") {
    await clearPaymentFailed(restaurantId);
  }

  if (
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired"
  ) {
    await handleRestaurantAccessLost(restaurantId);
  }
}

export async function handleStripeInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return;

  const existing = await getSubscriptionByStripeSubscriptionId(subscriptionId);
  if (!existing) return;

  await markPaymentFailed(existing.restaurant_id);
  await notifyFailureForRestaurant(existing.restaurant_id, "past_due");
}

export async function handleStripeInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return;

  const existing = await getSubscriptionByStripeSubscriptionId(subscriptionId);
  if (!existing) return;

  await clearPaymentFailed(existing.restaurant_id);
}
