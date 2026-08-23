import "server-only";

import { getStripeClient } from "@/lib/billing/stripe";
import {
  getBillingCheckoutCancelUrl,
  getBillingCheckoutSuccessUrl,
  getBillingPortalReturnUrl,
  getPreSignupCheckoutCancelUrl,
  getPreSignupCheckoutSuccessUrl,
  getStripePortalConfigurationId,
  getStripePriceId,
} from "@/lib/billing/config";
import { getCheckoutUserQuantity } from "@/lib/billing/seats";
import {
  getSubscriptionByRestaurantId,
  upsertSubscriptionRow,
} from "@/lib/billing/subscriptionDb";
import { supabaseServer } from "@/lib/supabaseServer";

export async function createBillingCheckoutSession(params: {
  restaurantId: string;
  ownerUserId: string;
  ownerEmail: string;
  restaurantName: string;
}): Promise<{ url: string } | { error: string }> {
  const priceId = getStripePriceId();
  if (!priceId) return { error: "Stripe n'est pas configuré." };

  const userQuantity = await getCheckoutUserQuantity(params.restaurantId);

  const stripe = getStripeClient();
  const existing = await getSubscriptionByRestaurantId(params.restaurantId);

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: params.ownerEmail,
      name: params.restaurantName,
      metadata: {
        restaurant_id: params.restaurantId,
        owner_user_id: params.ownerUserId,
      },
    });
    customerId = customer.id;
    await upsertSubscriptionRow({
      restaurant_id: params.restaurantId,
      stripe_customer_id: customerId,
      status: "inactive",
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: userQuantity }],
    success_url: getBillingCheckoutSuccessUrl(),
    cancel_url: getBillingCheckoutCancelUrl(),
    metadata: {
      restaurant_id: params.restaurantId,
      owner_user_id: params.ownerUserId,
    },
    subscription_data: {
      metadata: {
        restaurant_id: params.restaurantId,
        owner_user_id: params.ownerUserId,
      },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) return { error: "Impossible de créer la session Checkout." };
  return { url: session.url };
}

/** Checkout avant création du restaurant (inscription Pro). */
export async function createPreSignupCheckoutSession(params: {
  ownerUserId: string;
  ownerEmail: string;
}): Promise<{ url: string } | { error: string }> {
  const priceId = getStripePriceId();
  if (!priceId) return { error: "Stripe n'est pas configuré." };

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: params.ownerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: getPreSignupCheckoutSuccessUrl(),
    cancel_url: getPreSignupCheckoutCancelUrl(),
    metadata: {
      owner_user_id: params.ownerUserId,
      signup_flow: "pre_restaurant",
    },
    subscription_data: {
      metadata: {
        owner_user_id: params.ownerUserId,
        signup_flow: "pre_restaurant",
      },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) return { error: "Impossible de créer la session Checkout." };
  return { url: session.url };
}

export async function createBillingPortalSession(
  restaurantId: string
): Promise<{ url: string } | { error: string }> {
  const existing = await getSubscriptionByRestaurantId(restaurantId);
  if (!existing?.stripe_customer_id) {
    return { error: "Aucun abonnement Stripe associé à cet établissement." };
  }

  const stripe = getStripeClient();
  const configurationId = getStripePortalConfigurationId();
  const session = await stripe.billingPortal.sessions.create({
    customer: existing.stripe_customer_id,
    return_url: getBillingPortalReturnUrl(),
    ...(configurationId ? { configuration: configurationId } : {}),
  });

  return { url: session.url };
}

export async function verifyRestaurantOwner(
  restaurantId: string,
  userId: string
): Promise<{ ok: true; name: string; email: string } | { error: string }> {
  const { data: rest } = await supabaseServer
    .from("restaurants")
    .select("name, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!rest) return { error: "Restaurant introuvable." };
  if (rest.owner_id !== userId) return { error: "Non autorisé." };

  const { data: userData } = await supabaseServer.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (!email) return { error: "Email propriétaire introuvable." };

  return { ok: true, name: rest.name as string, email };
}
