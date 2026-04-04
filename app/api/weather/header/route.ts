import { NextResponse } from "next/server";
import { getCurrentRestaurant, getCurrentUser } from "@/lib/auth";
import { fetchSevenDayForecast } from "@/lib/calendar/openMeteo";
import { resolveRestaurantCoordsForWeather } from "@/lib/geo/resolveRestaurantCoordsForWeather";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurant = await getCurrentRestaurant();
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

  const days = await fetchSevenDayForecast(coords.latitude, coords.longitude);
  if (!days?.length) {
    return NextResponse.json({ error: "forecast_unavailable", restaurantId: restaurant.id });
  }

  return NextResponse.json({ days, restaurantId: restaurant.id });
}
