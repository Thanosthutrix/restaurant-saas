import { NextResponse, after } from "next/server";
import { refreshAllExperienceProfiles } from "@/lib/b2c/experience/refreshProfileAi";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron hebdomadaire — enrichit profils expérience (avis + carte + IA). */
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
      const result = await refreshAllExperienceProfiles();
      if (result.errors.length > 0) {
        console.warn("[cron/experience-profiles-refresh]", result.errors.slice(0, 5).join(" · "));
      }
      console.info("[cron/experience-profiles-refresh]", result);
    } catch (err) {
      console.error("[cron/experience-profiles-refresh]", err);
    }
  });

  return NextResponse.json({
    ok: true,
    accepted: true,
    message: "Rafraîchissement des profils expérience démarré.",
  });
}
