import "server-only";

import { isPastDueGraceExpired } from "@/lib/billing/config";
import { getSubscriptionByRestaurantId } from "@/lib/billing/subscriptionDb";
import { getActiveSignupEntitlement } from "@/lib/pro/signupEntitlementDb";
import { supabaseServer } from "@/lib/supabaseServer";

export type TrialBannerInfo = {
  expiresAt: string;
  daysRemaining: number;
  /** Essai pré-création restaurant (entitlement) vs essai établissement actif. */
  phase: "signup" | "restaurant";
};

export function computeTrialDaysRemaining(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function subscriptionBlocksTrialBanner(
  status: string | null,
  lastPaymentFailedAt: string | null
): boolean {
  if (!status || status === "inactive") return false;
  if (status === "active" || status === "trialing") return true;
  if (status === "past_due") return !isPastDueGraceExpired(lastPaymentFailedAt);
  return false;
}

/** Bandeau essai pour un utilisateur sans restaurant (entitlement approuvé). */
export async function getUserSignupTrialBanner(userId: string): Promise<TrialBannerInfo | null> {
  const ent = await getActiveSignupEntitlement(userId);
  if (!ent || ent.kind !== "trial" || !ent.expires_at) return null;
  if (new Date(ent.expires_at) <= new Date()) return null;

  return {
    expiresAt: ent.expires_at,
    daysRemaining: computeTrialDaysRemaining(ent.expires_at),
    phase: "signup",
  };
}

/** Bandeau essai pour l'établissement actif (trial_accesses, hors abonnement payant). */
export async function getRestaurantTrialBanner(
  restaurantId: string
): Promise<TrialBannerInfo | null> {
  const [subscription, trialResult] = await Promise.all([
    getSubscriptionByRestaurantId(restaurantId),
    supabaseServer
      .from("trial_accesses")
      .select("expires_at")
      .eq("restaurant_id", restaurantId)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    subscriptionBlocksTrialBanner(
      subscription?.status ?? null,
      subscription?.last_payment_failed_at ?? null
    )
  ) {
    return null;
  }

  const expiresAt = (trialResult.data as { expires_at?: string } | null)?.expires_at ?? null;
  if (!expiresAt || new Date(expiresAt) <= new Date()) return null;

  return {
    expiresAt,
    daysRemaining: computeTrialDaysRemaining(expiresAt),
    phase: "restaurant",
  };
}
