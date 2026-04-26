import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
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

  const access = await getShellAccessContext(user.id);
  if (!access) {
    return NextResponse.json({
      restaurants: [],
      currentRestaurantId: null,
      establishment: null,
      allowedNavKeys: [],
    });
  }

  const establishment = access.currentRestaurant
    ? { restaurantId: access.currentRestaurant.id, ...getEstablishmentLabels(access.currentRestaurant) }
    : null;

  return NextResponse.json({
    restaurants: access.restaurants,
    currentRestaurantId: access.currentRestaurantId,
    establishment,
    allowedNavKeys: access.allowedNavKeys,
  });
}
