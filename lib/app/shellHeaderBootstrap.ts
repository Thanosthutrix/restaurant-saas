import { getCurrentUser, getRestaurantHeaderSession } from "@/lib/auth";
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
};

/** Données header (établissement + météo) calculées côté serveur — évite le fetch client fragile. */
export async function buildShellHeaderBootstrap(): Promise<AppShellHeaderBootstrap | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { restaurants, current } = await getRestaurantHeaderSession(user.id);
  const rows = restaurants.map((r) => ({ id: r.id, name: r.name }));

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
    currentRestaurantId: current?.id ?? null,
    establishment,
    weather,
    weatherHint,
  };
}
