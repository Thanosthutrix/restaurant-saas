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
    };
  }

  const current = access.currentRestaurant;
  const rows = access.restaurants;

  const establishment = current
    ? { restaurantId: current.id, ...getEstablishmentLabels(current) }
    : null;

  return {
    restaurants: rows,
    currentRestaurantId: access.currentRestaurantId,
    establishment,
    weather: null,
    weatherHint: null,
    allowedNavKeys: access.allowedNavKeys,
  };
}
