import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import type { ShellNavKey } from "@/lib/auth/appRoles";
import { fetchSevenDayForecast, type DailyWeatherPoint } from "@/lib/calendar/openMeteo";
import { resolveRestaurantCoordsForWeather } from "@/lib/geo/resolveRestaurantCoordsForWeather";
import { getEstablishmentLabels } from "@/lib/restaurant/establishmentLabels";

export type AppShellHeaderBootstrap = {
  restaurants: { id: string; name: string }[];
  currentRestaurantId: string | null;
  establishment: {
    restaurantId: string;
    activityLabel: string;
    serviceLabel: string;
    avgCovers: number | null;
  } | null;
  weather: { days: DailyWeatherPoint[]; restaurantId: string } | null;
  weatherHint:
    | { kind: "no_location"; restaurantId: string }
    | { kind: "forecast_unavailable"; restaurantId: string }
    | null;
  /** Vide si aucun accès restaurant ; sinon filtre le menu latéral. */
  allowedNavKeys: ShellNavKey[];
};

/** Données header (établissement + météo) calculées côté serveur — évite le fetch client fragile. */
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

  let weather: { days: DailyWeatherPoint[]; restaurantId: string } | null = null;
  let weatherHint: AppShellHeaderBootstrap["weatherHint"] = null;

  if (current) {
    try {
      const coords = await resolveRestaurantCoordsForWeather(current);
      if (!coords) {
        weatherHint = { kind: "no_location", restaurantId: current.id };
      } else {
        const days = await fetchSevenDayForecast(coords.latitude, coords.longitude);
        if (days?.length) {
          weather = { days, restaurantId: current.id };
        } else {
          weatherHint = { kind: "forecast_unavailable", restaurantId: current.id };
        }
      }
    } catch {
      weatherHint = { kind: "forecast_unavailable", restaurantId: current.id };
    }
  }

  return {
    restaurants: rows,
    currentRestaurantId: access.currentRestaurantId,
    establishment,
    weather,
    weatherHint,
    allowedNavKeys: access.allowedNavKeys,
  };
}
