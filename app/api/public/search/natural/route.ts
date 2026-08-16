import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { listPublicRestaurants } from "@/lib/public/data";
import { listExperienceProfilesForPublicRestaurants } from "@/lib/b2c/experience/experienceDb";
import {
  parseNaturalSearchQuery,
  runNaturalSearchMatches,
  embedSearchQuery,
} from "@/lib/b2c/experience/aiSearch";
import { checkAndIncrementAiSearchRateLimit } from "@/lib/b2c/experience/rateLimit";
import { getConsumerSearchPreferences } from "@/lib/b2c/experience/consumerPreferencesDb";
import { getCurrentUser } from "@/lib/auth";

function clientKeyFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = h.get("x-real-ip")?.trim();
  return `ip:${forwarded || realIp || "anonymous"}`;
}

export async function POST(req: Request) {
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps JSON invalide." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query || query.length > 500) {
    return NextResponse.json({ ok: false, error: "Requête trop courte ou trop longue." }, { status: 400 });
  }

  const h = await headers();
  const clientKey = clientKeyFromHeaders(h);
  const rate = await checkAndIncrementAiSearchRateLimit(clientKey);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Limite de recherches IA atteinte (5 par 24 h). Utilisez le parcours « Guide-moi ».",
        code: "rate_limited",
      },
      { status: 429 }
    );
  }

  const parsed = await parseNaturalSearchQuery(query);
  if (!parsed.inScope) {
    return NextResponse.json({
      ok: false,
      error: parsed.rejectReason ?? "Requête hors sujet.",
      code: "out_of_scope",
    });
  }

  const user = await getCurrentUser();
  const consumerPrefs = user ? await getConsumerSearchPreferences(user.id) : null;
  const queryEmbedding = await embedSearchQuery(query);

  const restaurants = await listPublicRestaurants();
  const ids = restaurants.map((r) => r.id);
  const { data: profiles } = await listExperienceProfilesForPublicRestaurants(ids);
  const matches = runNaturalSearchMatches(restaurants, profiles, parsed, {
    consumerPreferences: consumerPrefs,
    queryEmbedding,
  });

  return NextResponse.json({
    ok: true,
    summary: parsed.summaryForUser,
    remainingAiSearches: rate.remaining,
    matches: matches.map((m) => ({
      restaurantId: m.restaurant.id,
      name: m.restaurant.name,
      affinityPct: m.affinityPct,
      reasons: m.reasons,
      justification: m.justification,
    })),
  });
}
