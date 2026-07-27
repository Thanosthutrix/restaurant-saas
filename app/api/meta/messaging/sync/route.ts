import { NextResponse } from "next/server";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { syncMetaMessagingFromGraph } from "@/lib/meta/messagingSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sync inbox Meta + bot pour le restaurant actif (app ouverte, polling client). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Non connecté." }, { status: 401 });
  }

  let body: { restaurantId?: string };
  try {
    body = (await request.json()) as { restaurantId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide." }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim();
  if (!restaurantId) {
    return NextResponse.json({ ok: false, error: "Restaurant manquant." }, { status: 400 });
  }

  const accessible = await getAccessibleRestaurantsForUser(user.id);
  if (!accessible.some((r) => r.id === restaurantId)) {
    return NextResponse.json({ ok: false, error: "Accès refusé." }, { status: 403 });
  }

  try {
    const result = await syncMetaMessagingFromGraph(restaurantId);
    return NextResponse.json({ ok: true, syncedMessages: result.syncedMessages });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync impossible." },
      { status: 500 }
    );
  }
}
