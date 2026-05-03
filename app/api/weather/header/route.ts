import { NextResponse } from "next/server";
import { getRestaurantForPage, getCurrentUser } from "@/lib/auth";
import { fetchSevenDayForecast } from "@/lib/calendar/openMeteo";
import { resolveRestaurantCoordsForWeather } from "@/lib/geo/resolveRestaurantCoordsForWeather";

/** Toujours relire le restaurant courant et les APIs externes (pas de réponse figée au build). */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurant = await getRestaurantForPage();
  if (!restaurant) {
    return NextResponse.json({ error: "no_restaurant" }, { status: 404 });
  }

  const coords = await resolveRestaurantCoordsForWeather(restaurant);
  if (!coords) {
    return NextResponse.json({
      error: "no_location",
      restaurantId: restaurant.id,
    });
  }

  let days: Awaited<ReturnType<typeof fetchSevenDayForecast>>;
  try {
    days = await fetchSevenDayForecast(coords.latitude, coords.longitude);
  } catch {
    return NextResponse.json({ error: "forecast_unavailable", restaurantId: restaurant.id });
  }
  if (!days?.length) {
    return NextResponse.json({ error: "forecast_unavailable", restaurantId: restaurant.id });
  }

  return NextResponse.json({ days, restaurantId: restaurant.id });
}
