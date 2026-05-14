"use server";

import { isAppRole, type AppRole, type ShellNavKey } from "@/lib/auth/appRoles";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Capacités métier vérifiées côté serveur (en plus du menu / navigation).
 * Le propriétaire du restaurant a toujours le droit.
 */
export type RestaurantActionCapability =
  | "inventory.mutate"
  | "dishes.mutate"
  | "staff.manage"
  | "planning.mutate"
  | "hygiene.mutate"
  | "clients.mutate"
  | "suppliers.mutate"
  | "supplier_invoices.mutate"
  | "reservations.mutate";

const CAPABILITY_ROLES: Record<RestaurantActionCapability, readonly AppRole[]> = {
  "inventory.mutate": ["manager", "cuisine", "achats"],
  "dishes.mutate": ["manager", "cuisine"],
  "staff.manage": ["manager"],
  "planning.mutate": ["manager"],
  "hygiene.mutate": ["manager", "hygiene"],
  "clients.mutate": ["manager", "service", "achats"],
  "suppliers.mutate": ["manager", "achats"],
  "supplier_invoices.mutate": ["manager", "achats"],
  "reservations.mutate": ["manager", "service"],
};

/**
 * Clé de navigation (accès complet, non-readonly) requise pour chaque capacité.
 * Si `app_nav_keys` est défini, on vérifie cette clé directement.
 */
const CAPABILITY_NAV_KEY: Record<RestaurantActionCapability, ShellNavKey> = {
  "inventory.mutate": "inventory",
  "dishes.mutate": "dishes",
  "staff.manage": "equipe_manage",
  "planning.mutate": "equipe_manage",
  "hygiene.mutate": "hygiene",
  "clients.mutate": "clients",
  "suppliers.mutate": "suppliers",
  "supplier_invoices.mutate": "supplier_invoices",
  "reservations.mutate": "reservations",
};

export async function assertRestaurantAction(
  userId: string,
  restaurantId: string,
  capability: RestaurantActionCapability
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rest, error: restErr } = await supabaseServer
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restErr || !rest) {
    return { ok: false, error: "Restaurant introuvable." };
  }
  if ((rest as { owner_id: string }).owner_id === userId) {
    return { ok: true };
  }

  const { data: sm, error: smErr } = await supabaseServer
    .from("staff_members")
    .select("app_role, app_nav_keys, active")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (smErr || !sm) {
    return { ok: false, error: "Accès refusé." };
  }

  const rawKeys = (sm as { app_nav_keys: unknown }).app_nav_keys;
  const navKeys: string[] | null = Array.isArray(rawKeys) ? (rawKeys as string[]) : null;

  // Permissions personnalisées (app_nav_keys) → vérification directe de la clé complète
  if (navKeys && navKeys.length > 0) {
    const requiredKey = CAPABILITY_NAV_KEY[capability];
    if (navKeys.includes(requiredKey)) {
      return { ok: true };
    }
    return { ok: false, error: "Permissions insuffisantes pour cette action (lecture seule ou accès restreint)." };
  }

  // Fallback : vérification par app_role
  const role = (sm as { app_role: string | null }).app_role;
  if (!isAppRole(role)) {
    return { ok: false, error: "Accès refusé." };
  }
  const allowed = CAPABILITY_ROLES[capability];
  if (!(allowed as readonly string[]).includes(role)) {
    return { ok: false, error: "Permissions insuffisantes pour cette action." };
  }
  return { ok: true };
}
