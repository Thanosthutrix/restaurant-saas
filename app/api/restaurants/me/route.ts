import { NextResponse } from "next/server";
import { getCurrentUser, getAccessibleRestaurantsForUser, getCurrentRestaurant } from "@/lib/auth";
import { getEstablishmentLabels } from "@/lib/restaurant/establishmentLabels";

export const dynamic = "force-dynamic";

/**
 * Liste des restaurants accessibles + restaurant actif (cookie), pour le shell UI uniquement.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const [list, current] = await Promise.all([
    getAccessibleRestaurantsForUser(user.id),
    getCurrentRestaurant(),
  ]);

  const establishment = current
    ? { restaurantId: current.id, ...getEstablishmentLabels(current) }
    : null;

  return NextResponse.json({
    restaurants: list.map((r) => ({ id: r.id, name: r.name })),
    currentRestaurantId: current?.id ?? null,
    establishment,
  });
}
