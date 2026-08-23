import { supabaseServer } from "@/lib/supabaseServer";
import type Stripe from "stripe";
import { getStripePriceId } from "@/lib/billing/config";
import { subscriptionMrrCents } from "@/lib/billing/stripe";

export type RestaurantSubscriptionRow = {
  restaurant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  price_id: string | null;
  mrr_cents: number;
  currency: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  last_payment_failed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getSubscriptionByRestaurantId(
  restaurantId: string
): Promise<RestaurantSubscriptionRow | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_subscriptions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RestaurantSubscriptionRow;
}

export async function getSubscriptionByStripeCustomerId(
  stripeCustomerId: string
): Promise<RestaurantSubscriptionRow | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_subscriptions")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RestaurantSubscriptionRow;
}

export async function getSubscriptionByStripeSubscriptionId(
  stripeSubscriptionId: string
): Promise<RestaurantSubscriptionRow | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RestaurantSubscriptionRow;
}

export async function upsertSubscriptionRow(
  row: Partial<RestaurantSubscriptionRow> & { restaurant_id: string }
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabaseServer.from("restaurant_subscriptions").upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" }
  );

  if (error) return { error: error.message };
  return { ok: true };
}

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  restaurantId: string
): Promise<{ ok: true } | { error: string }> {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  return upsertSubscriptionRow({
    restaurant_id: restaurantId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    price_id: priceId,
    mrr_cents: subscriptionMrrCents(subscription),
    currency: subscription.currency ?? "eur",
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
  });
}

export async function markPaymentFailed(restaurantId: string): Promise<void> {
  await supabaseServer
    .from("restaurant_subscriptions")
    .update({
      last_payment_failed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId);
}

export async function clearPaymentFailed(restaurantId: string): Promise<void> {
  await supabaseServer
    .from("restaurant_subscriptions")
    .update({
      last_payment_failed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId);
}

export async function recordStripeWebhookEvent(params: {
  stripeEventId: string;
  eventType: string;
  payload: unknown;
}): Promise<boolean> {
  const { error } = await supabaseServer.from("stripe_webhook_events").insert({
    stripe_event_id: params.stripeEventId,
    event_type: params.eventType,
    payload: params.payload as Record<string, unknown>,
  });

  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

export type BillingStats = {
  mrrCents: number;
  arrCents: number;
  activeCount: number;
  pastDueCount: number;
  trialingCount: number;
  canceledCount: number;
  stripeConfigured: boolean;
};

export async function getBillingStats(): Promise<BillingStats> {
  const { data } = await supabaseServer.from("restaurant_subscriptions").select("status, mrr_cents");

  let mrrCents = 0;
  let activeCount = 0;
  let pastDueCount = 0;
  let trialingCount = 0;
  let canceledCount = 0;

  for (const row of data ?? []) {
    const status = row.status as string;
    const mrr = (row.mrr_cents as number) ?? 0;
    if (status === "active") {
      activeCount += 1;
      mrrCents += mrr;
    } else if (status === "past_due") {
      pastDueCount += 1;
      mrrCents += mrr;
    } else if (status === "trialing") {
      trialingCount += 1;
    } else if (status === "canceled" || status === "unpaid") {
      canceledCount += 1;
    }
  }

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeCount,
    pastDueCount,
    trialingCount,
    canceledCount,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && getStripePriceId()),
  };
}

export type PaymentFailureAlert = {
  restaurantId: string;
  restaurantName: string;
  ownerEmail: string | null;
  failedAt: string;
  status: string;
  mrrCents: number;
};

export async function getRecentPaymentFailures(limit = 10): Promise<PaymentFailureAlert[]> {
  const { data: subs } = await supabaseServer
    .from("restaurant_subscriptions")
    .select("restaurant_id, status, mrr_cents, last_payment_failed_at")
    .not("last_payment_failed_at", "is", null)
    .order("last_payment_failed_at", { ascending: false })
    .limit(limit);

  if (!subs?.length) return [];

  const restaurantIds = subs.map((s) => s.restaurant_id as string);
  const { data: restaurants } = await supabaseServer
    .from("restaurants")
    .select("id, name, owner_id")
    .in("id", restaurantIds);

  const restaurantMap = new Map(
    (restaurants ?? []).map((r) => [r.id as string, r as { id: string; name: string; owner_id: string }])
  );

  const results: PaymentFailureAlert[] = [];
  for (const sub of subs) {
    const rest = restaurantMap.get(sub.restaurant_id as string);
    if (!rest) continue;

    let ownerEmail: string | null = null;
    if (rest.owner_id) {
      const { data } = await supabaseServer.auth.admin.getUserById(rest.owner_id);
      ownerEmail = data?.user?.email ?? null;
    }

    results.push({
      restaurantId: rest.id,
      restaurantName: rest.name,
      ownerEmail,
      failedAt: sub.last_payment_failed_at as string,
      status: sub.status as string,
      mrrCents: (sub.mrr_cents as number) ?? 0,
    });
  }

  return results;
}

export async function getSubscriptionsWithRestaurants(): Promise<
  (RestaurantSubscriptionRow & { restaurantName: string; ownerEmail: string | null })[]
> {
  const { data: subs } = await supabaseServer
    .from("restaurant_subscriptions")
    .select("*")
    .neq("status", "inactive")
    .order("updated_at", { ascending: false });

  if (!subs?.length) return [];

  const restaurantIds = subs.map((s) => s.restaurant_id as string);
  const { data: restaurants } = await supabaseServer
    .from("restaurants")
    .select("id, name, owner_id")
    .in("id", restaurantIds);

  const restaurantMap = new Map(
    (restaurants ?? []).map((r) => [r.id as string, r as { id: string; name: string; owner_id: string }])
  );

  const out: (RestaurantSubscriptionRow & { restaurantName: string; ownerEmail: string | null })[] = [];

  for (const sub of subs) {
    const rest = restaurantMap.get(sub.restaurant_id as string);
    let ownerEmail: string | null = null;
    if (rest?.owner_id) {
      const { data } = await supabaseServer.auth.admin.getUserById(rest.owner_id);
      ownerEmail = data?.user?.email ?? null;
    }
    out.push({
      ...(sub as RestaurantSubscriptionRow),
      restaurantName: rest?.name ?? "Restaurant",
      ownerEmail,
    });
  }

  return out;
}
