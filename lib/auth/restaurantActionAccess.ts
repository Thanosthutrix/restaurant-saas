import { isAppRole, type AppRole } from "@/lib/auth/appRoles";
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
  | "reservations.mutate";

const CAPABILITY_ROLES: Record<RestaurantActionCapability, readonly AppRole[]> = {
  "inventory.mutate": ["manager", "cuisine", "achats"],
  "dishes.mutate": ["manager", "service", "cuisine"],
  "staff.manage": ["manager"],
  "planning.mutate": ["manager"],
  "hygiene.mutate": ["manager", "hygiene"],
  "clients.mutate": ["manager", "service", "achats"],
  "reservations.mutate": ["manager", "service"],
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
    .select("app_role, active")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (smErr || !sm) {
    return { ok: false, error: "Accès refusé." };
  }
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
