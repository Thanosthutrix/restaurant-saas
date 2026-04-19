import { cookies } from "next/headers";
import {
  ACTIVE_RESTAURANT_COOKIE,
  getAccessibleRestaurantsForUser,
  type Restaurant,
} from "@/lib/auth";
import { ALL_SHELL_NAV_KEYS, type ShellNavKey, navKeysForAppRole } from "@/lib/auth/appRoles";
import { getStaffMembershipForAccess } from "@/lib/staff/staffDb";

export type ShellAccessContext = {
  restaurants: { id: string; name: string }[];
  currentRestaurant: Restaurant | null;
  currentRestaurantId: string | null;
  allowedNavKeys: ShellNavKey[];
  /** True si l’utilisateur est propriétaire du restaurant courant (accès total). */
  isOwner: boolean;
};

/**
 * Contexte shell : restaurant actif + clés de menu autorisées.
 * Propriétaire : tous les accès sur ses établissements.
 * Collaborateur (staff_members.user_id) : selon app_role.
 */
export async function getShellAccessContext(userId: string): Promise<ShellAccessContext | null> {
  const owned = await getAccessibleRestaurantsForUser(userId);
  if (owned.length > 0) {
    const cookieStore = await cookies();
    const activeId = cookieStore.get(ACTIVE_RESTAURANT_COOKIE)?.value;
    const current = activeId
      ? (owned.find((r) => r.id === activeId) ?? owned[0])
      : owned[0];
    return {
      restaurants: owned.map((r) => ({ id: r.id, name: r.name })),
      currentRestaurant: current,
      currentRestaurantId: current.id,
      allowedNavKeys: [...ALL_SHELL_NAV_KEYS],
      isOwner: true,
    };
  }

  const sm = await getStaffMembershipForAccess(userId);
  if (!sm) return null;

  return {
    restaurants: [{ id: sm.restaurant_id, name: sm.restaurant_name }],
    currentRestaurant: sm.restaurant,
    currentRestaurantId: sm.restaurant_id,
    allowedNavKeys: navKeysForAppRole(sm.app_role),
    isOwner: false,
  };
}
