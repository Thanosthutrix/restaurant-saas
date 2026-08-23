import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { isCurrentUserAdmin } from "@/lib/admin";
import {
  isActiveSubscriptionStatus,
  isPastDueGraceExpired,
} from "@/lib/billing/config";
import { getSubscriptionByRestaurantId } from "@/lib/billing/subscriptionDb";
import { handleRestaurantAccessLost } from "@/lib/platform/publicListingAccess";

export type RestaurantAccessBlockReason =
  | "suspended"
  | "trial_expired"
  | "subscription_inactive"
  | "no_entitlement";

export type RestaurantAccessStatus = {
  canAccess: boolean;
  reason: RestaurantAccessBlockReason | null;
  suspendedReason: string | null;
  trialExpiresAt: string | null;
  hasTrialRecord: boolean;
  subscriptionStatus: string | null;
  accessPolicy: string;
};

function subscriptionGrantsAccess(
  status: string | null,
  lastPaymentFailedAt: string | null
): boolean {
  if (!status || status === "inactive") return false;
  if (status === "active" || status === "trialing") return true;
  if (status === "past_due") {
    return !isPastDueGraceExpired(lastPaymentFailedAt);
  }
  return false;
}

function trialIsActive(expiresAt: string | null): boolean {
  return Boolean(expiresAt && new Date(expiresAt) > new Date());
}

/**
 * Vérifie si un restaurant peut utiliser l'app pro.
 * - Suspendu → bloqué
 * - Abonnement actif (y compris jusqu'à fin de période si cancel_at_period_end) → autorisé
 * - Essai plateforme en cours → autorisé
 * - Essai expiré / abonnement inactif → bloqué + retrait portail public
 * - require_entitlement sans essai ni abo → bloqué
 * - legacy_free sans essai ni abo → autorisé (clients historiques)
 */
export const getRestaurantAccessStatus = cache(async function getRestaurantAccessStatus(
  restaurantId: string
): Promise<RestaurantAccessStatus> {
  const [restaurantResult, trialResult, subscription] = await Promise.all([
    supabaseServer
      .from("restaurants")
      .select("suspended_at, suspended_reason, access_policy")
      .eq("id", restaurantId)
      .maybeSingle(),
    supabaseServer
      .from("trial_accesses")
      .select("expires_at")
      .eq("restaurant_id", restaurantId)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSubscriptionByRestaurantId(restaurantId),
  ]);

  const suspendedAt = restaurantResult.data?.suspended_at ?? null;
  const suspendedReason = restaurantResult.data?.suspended_reason ?? null;
  const accessPolicy =
    (restaurantResult.data as { access_policy?: string } | null)?.access_policy ?? "legacy_free";
  const trialExpiresAt = (trialResult.data as { expires_at?: string } | null)?.expires_at ?? null;
  const hasTrialRecord = Boolean(trialResult.data);
  const subscriptionStatus = subscription?.status ?? null;
  const activeTrial = hasTrialRecord && trialIsActive(trialExpiresAt);

  const base = {
    suspendedReason,
    trialExpiresAt,
    hasTrialRecord,
    subscriptionStatus,
    accessPolicy,
  };

  if (suspendedAt) {
    return { canAccess: false, reason: "suspended", ...base };
  }

  if (subscriptionGrantsAccess(subscriptionStatus, subscription?.last_payment_failed_at ?? null)) {
    return { canAccess: true, reason: null, ...base };
  }

  if (activeTrial) {
    return { canAccess: true, reason: null, ...base };
  }

  if (hasTrialRecord && trialExpiresAt && new Date(trialExpiresAt) <= new Date()) {
    return { canAccess: false, reason: "trial_expired", ...base };
  }

  if (
    subscriptionStatus &&
    subscriptionStatus !== "inactive" &&
    !subscriptionGrantsAccess(subscriptionStatus, subscription?.last_payment_failed_at ?? null)
  ) {
    return { canAccess: false, reason: "subscription_inactive", ...base };
  }

  if (accessPolicy === "require_entitlement") {
    return { canAccess: false, reason: "no_entitlement", ...base };
  }

  return { canAccess: true, reason: null, ...base };
});

/** Redirige vers /access-blocked si le restaurant n'a pas accès (sauf admin plateforme). */
export async function requireRestaurantPlatformAccess(restaurantId: string | null): Promise<void> {
  if (!restaurantId) return;
  if (await isCurrentUserAdmin()) return;

  const status = await getRestaurantAccessStatus(restaurantId);
  if (!status.canAccess && status.reason) {
    if (
      status.reason === "trial_expired" ||
      status.reason === "subscription_inactive" ||
      status.reason === "no_entitlement"
    ) {
      await handleRestaurantAccessLost(restaurantId);
    }
    redirect(`/access-blocked?reason=${status.reason}`);
  }
}
