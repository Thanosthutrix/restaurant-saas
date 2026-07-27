import { NextResponse } from "next/server";
import { syncAllRestaurantsMetaMessaging } from "@/lib/meta/syncAllMetaMessaging";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron Vercel — sync DM Meta + bot toutes les minutes (sans ouvrir Ubion). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const result = await syncAllRestaurantsMetaMessaging();
    if (result.errors.length > 0) {
      console.warn("[cron/meta-messaging-sync]", result.errors.join(" · "));
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/meta-messaging-sync]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erreur sync." },
      { status: 500 }
    );
  }
}
