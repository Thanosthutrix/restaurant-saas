import { NextResponse, after } from "next/server";
import { syncAllRestaurantsMetaMessaging } from "@/lib/meta/syncAllMetaMessaging";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron externe — sync DM Meta + bot (répond vite, travail en arrière-plan). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  after(async () => {
    try {
      const result = await syncAllRestaurantsMetaMessaging();
      if (result.errors.length > 0) {
        console.warn("[cron/meta-messaging-sync]", result.errors.join(" · "));
      } else {
        console.info("[cron/meta-messaging-sync] ok", result);
      }
    } catch (err) {
      console.error("[cron/meta-messaging-sync]", err);
    }
  });

  return NextResponse.json({
    ok: true,
    accepted: true,
    message: "Sync Meta démarrée en arrière-plan.",
  });
}
