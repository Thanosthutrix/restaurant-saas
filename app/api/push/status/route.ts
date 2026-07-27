import { NextResponse } from "next/server";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { getPushStatusForRestaurant } from "@/lib/push/pushStatus";

export const dynamic = "force-dynamic";

/** État push serveur + tokens équipe (diagnostic, sans secrets). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Non connecté." }, { status: 401 });
  }

  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim();
  if (!restaurantId) {
    return NextResponse.json({ ok: false, error: "restaurantId manquant." }, { status: 400 });
  }

  const accessible = await getAccessibleRestaurantsForUser(user.id);
  if (!accessible.some((r) => r.id === restaurantId)) {
    return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 403 });
  }

  const status = await getPushStatusForRestaurant(restaurantId);
  return NextResponse.json({ ok: true, status });
}
