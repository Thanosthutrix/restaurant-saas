import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

export type ProSignupEntitlementRow = {
  id: string;
  user_id: string;
  kind: "trial" | "subscription";
  status: string;
  expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_request_id: string | null;
  restaurant_id: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getActiveSignupEntitlement(
  userId: string
): Promise<ProSignupEntitlementRow | null> {
  const { data } = await supabaseServer
    .from("pro_signup_entitlements")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const row = data as ProSignupEntitlementRow;
  if (row.kind === "trial" && row.expires_at && new Date(row.expires_at) <= new Date()) {
    await supabaseServer
      .from("pro_signup_entitlements")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return null;
  }

  return row;
}

export async function userCanCreateRestaurant(params: {
  userId: string;
  hasProspectInvite: boolean;
}): Promise<boolean> {
  if (params.hasProspectInvite) return true;
  const ent = await getActiveSignupEntitlement(params.userId);
  return ent != null;
}

export async function createSubscriptionSignupEntitlement(params: {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabaseServer.from("pro_signup_entitlements").insert({
    user_id: params.userId,
    kind: "subscription",
    status: "active",
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
  });

  if (error?.code === "23505") {
    const { error: upd } = await supabaseServer
      .from("pro_signup_entitlements")
      .update({
        kind: "subscription",
        status: "active",
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", params.userId)
      .eq("status", "active")
      .is("consumed_at", null);
    if (upd) return { error: upd.message };
    return { ok: true };
  }

  if (error) return { error: error.message };
  return { ok: true };
}

export async function consumeSignupEntitlement(params: {
  userId: string;
  restaurantId: string;
}): Promise<ProSignupEntitlementRow | null> {
  const ent = await getActiveSignupEntitlement(params.userId);
  if (!ent) return null;

  const { error } = await supabaseServer
    .from("pro_signup_entitlements")
    .update({
      status: "consumed",
      consumed_at: new Date().toISOString(),
      restaurant_id: params.restaurantId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ent.id);

  if (error) {
    console.error("[consumeSignupEntitlement]", error.message);
    return null;
  }

  return ent;
}

export async function getSignupEntitlementByStripeSubscriptionId(
  stripeSubscriptionId: string
): Promise<ProSignupEntitlementRow | null> {
  const { data } = await supabaseServer
    .from("pro_signup_entitlements")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ProSignupEntitlementRow | null) ?? null;
}
