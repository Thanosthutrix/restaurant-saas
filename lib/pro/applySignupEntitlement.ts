import "server-only";

import { getStripeClient } from "@/lib/billing/stripe";
import { upsertSubscriptionRow } from "@/lib/billing/subscriptionDb";
import { consumeSignupEntitlement, type ProSignupEntitlementRow } from "@/lib/pro/signupEntitlementDb";
import { supabaseServer } from "@/lib/supabaseServer";

/** Applique l'essai ou l'abonnement pré-payé au restaurant nouvellement créé. */
export async function applySignupEntitlementToRestaurant(params: {
  userId: string;
  restaurantId: string;
}): Promise<void> {
  const ent = await consumeSignupEntitlement(params);
  if (!ent) return;

  if (ent.kind === "trial" && ent.expires_at) {
    await supabaseServer.from("trial_accesses").insert({
      restaurant_id: params.restaurantId,
      granted_by: null,
      source: "organic",
      expires_at: ent.expires_at,
      notes: "Essai approuvé avant création du restaurant",
    });
    return;
  }

  if (ent.kind === "subscription") {
    await linkSubscriptionEntitlementToRestaurant(ent, params.restaurantId, params.userId);
  }
}

async function linkSubscriptionEntitlementToRestaurant(
  ent: ProSignupEntitlementRow,
  restaurantId: string,
  ownerUserId: string
): Promise<void> {
  await upsertSubscriptionRow({
    restaurant_id: restaurantId,
    stripe_customer_id: ent.stripe_customer_id,
    stripe_subscription_id: ent.stripe_subscription_id,
    status: "active",
  });

  if (ent.stripe_subscription_id) {
    try {
      const stripe = getStripeClient();
      await stripe.subscriptions.update(ent.stripe_subscription_id, {
        metadata: {
          restaurant_id: restaurantId,
          owner_user_id: ownerUserId,
        },
      });
    } catch (err) {
      console.error("[applySignupEntitlement] subscription metadata update failed:", err);
    }
  }
}
