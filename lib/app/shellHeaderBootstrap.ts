import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import type { ShellNavKey } from "@/lib/auth/appRoles";
import type { DailyWeatherPoint } from "@/lib/calendar/openMeteo";
import { getEstablishmentLabels } from "@/lib/restaurant/establishmentLabels";

export type AppShellHeaderBootstrap = {
  restaurants: { id: string; name: string }[];
  currentRestaurantId: string | null;
  establishment: {
    restaurantId: string;
    activityLabel: string;
    serviceLabel: string;
    emailSenderLabel: string;
    addressLabel: string | null;
  } | null;
  weather: { days: DailyWeatherPoint[]; restaurantId: string } | null;
  weatherHint:
    | { kind: "no_location"; restaurantId: string }
    | { kind: "forecast_unavailable"; restaurantId: string }
    | null;
  /** Vide si aucun accès restaurant ; sinon filtre le menu latéral. */
  allowedNavKeys: ShellNavKey[];
  /**
   * Profil de l'utilisateur connecté tel qu'affiché dans l'avatar du header.
   * `staffMemberId` + `colorIndex` uniquement pour les collaborateurs (null pour les propriétaires).
   */
  userProfile: {
    displayName: string;
    /** Index (0-9) dans la palette STAFF_COLORS. Null si propriétaire sans fiche staff. */
    colorIndex: number | null;
    /** Id de la fiche staff (null = propriétaire sans fiche). */
    staffMemberId: string | null;
    restaurantId: string | null;
    /** Index de couleurs déjà pris par les autres membres (pour bloquer dans le picker). */
    usedColorIndexes: number[];
  } | null;
};

/** Données header critiques calculées côté serveur. La météo est chargée côté client pour ne pas bloquer les pages. */
export async function buildShellHeaderBootstrap(): Promise<AppShellHeaderBootstrap | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const access = await getShellAccessContext(user.id);
  if (!access) {
    return {
      restaurants: [],
      currentRestaurantId: null,
      establishment: null,
      weather: null,
      weatherHint: null,
      allowedNavKeys: [],
      userProfile: {
        displayName: user.email?.split("@")[0] ?? "Utilisateur",
        colorIndex: null,
        staffMemberId: null,
        restaurantId: null,
      },
    };
  }

  const current = access.currentRestaurant;
  const rows = access.restaurants;

  const establishment = current
    ? { restaurantId: current.id, ...getEstablishmentLabels(current) }
    : null;

  // Profil staff (collaborateurs uniquement — les propriétaires n'ont pas de fiche staff en général)
  let userProfile: AppShellHeaderBootstrap["userProfile"] = null;
  if (!access.isOwner && access.currentRestaurantId) {
    const { getStaffMembershipForAccess, listStaffMembers } = await import("@/lib/staff/staffDb");
    const { resolveStaffColorIndex } = await import("@/lib/staff/staffColors");
    const sm = await getStaffMembershipForAccess(user.id);
    if (sm) {
      // Couleurs déjà utilisées par les AUTRES membres actifs du restaurant
      const allStaff = await listStaffMembers(sm.restaurant_id);
      const allIds = allStaff.map((s) => s.id);
      const usedColorIndexes = allStaff
        .filter((s) => s.id !== sm.staff_member_id)
        .map((s) => resolveStaffColorIndex(s.id, s.color_index, allIds));

      userProfile = {
        displayName: sm.display_name,
        colorIndex: sm.color_index,
        staffMemberId: sm.staff_member_id,
        restaurantId: sm.restaurant_id,
        usedColorIndexes,
      };
    }
  }

  if (!userProfile) {
    userProfile = {
      displayName: user.email?.split("@")[0] ?? "Propriétaire",
      colorIndex: null,
      staffMemberId: null,
      restaurantId: access.currentRestaurantId,
      usedColorIndexes: [],
    };
  }

  return {
    restaurants: rows,
    currentRestaurantId: access.currentRestaurantId,
    establishment,
    weather: null,
    weatherHint: null,
    allowedNavKeys: access.allowedNavKeys,
    userProfile,
  };
}
