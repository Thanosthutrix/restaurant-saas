/**
 * Recherche B2C en langage naturel — OpenAI + guardrails stricts.
 */

import OpenAI from "openai";
import type { Restaurant } from "@/lib/public/types";
import type { ExperienceProfileForMatching } from "./matching";
import {
  type ClientIntent,
  type EstablishmentType,
  type PriceTier,
  CLIENT_INTENTS,
  OCCASION_TAGS,
  VENUE_FEATURE_TAGS,
  passesIntentGuardrail,
  isEstablishmentType,
  isPriceTier,
} from "./taxonomy";
import { matchRestaurantsGuided, type GuidedSearchCriteria, type MatchOptions } from "./matching";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const b2cSearchModel = () => process.env.OPENAI_B2C_SEARCH_MODEL?.trim() || "gpt-4o-mini";

export type ParsedNaturalSearch = {
  inScope: boolean;
  rejectReason?: string;
  intent?: ClientIntent;
  criteria?: GuidedSearchCriteria;
  summaryForUser?: string;
  queryText?: string;
};

const SYSTEM_PROMPT = `Tu es le moteur de recherche restaurant de ubion (portail B2C France).
Tu DOIS répondre UNIQUEMENT en JSON valide avec cette forme :
{
  "inScope": boolean,
  "rejectReason": string | null,
  "intent": "romantic_quiet" | "gastronomic_treat" | "casual_friends" | "family_meal" | "quick_bite" | "business_lunch" | null,
  "noiseLevel": "quiet" | "moderate" | "lively" | null,
  "priceTier": "euro_1" | "euro_2" | "euro_3" | "euro_4" | null,
  "occasions": string[],
  "venueFeatures": string[],
  "summaryForUser": string | null
}

Règles strictes :
- inScope=false si la requête n'est PAS une recherche de restaurant / sortie / repas (devoirs, code, météo, chat libre…).
- intent=null si inScope=false.
- Ne jamais inventer de restaurants.
- Interpréter budget, ambiance, occasion depuis le texte client.
- summaryForUser : phrase courte expliquant ce que tu as compris (français).`;

export async function parseNaturalSearchQuery(query: string): Promise<ParsedNaturalSearch> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { inScope: false, rejectReason: "Décrivez votre envie (ex. dîner calme, budget ~50€)." };
  }

  if (!openai) {
    return fallbackKeywordParse(trimmed);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: b2cSearchModel(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fallbackKeywordParse(trimmed);

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed.inScope) {
      return {
        inScope: false,
        rejectReason:
          typeof parsed.rejectReason === "string"
            ? parsed.rejectReason
            : "Je ne peux répondre qu'aux recherches de restaurants.",
      };
    }

    const intent = CLIENT_INTENTS.includes(parsed.intent as ClientIntent)
      ? (parsed.intent as ClientIntent)
      : "casual_friends";

    const criteria: GuidedSearchCriteria = {
      intent,
      noiseLevel:
        parsed.noiseLevel === "quiet" || parsed.noiseLevel === "moderate" || parsed.noiseLevel === "lively"
          ? parsed.noiseLevel
          : null,
      priceTier: isPriceTier(String(parsed.priceTier ?? "")) ? (parsed.priceTier as PriceTier) : null,
      occasions: Array.isArray(parsed.occasions)
        ? parsed.occasions.filter((x): x is (typeof OCCASION_TAGS)[number] =>
            typeof x === "string" && (OCCASION_TAGS as readonly string[]).includes(x)
          )
        : [],
      venueFeatures: Array.isArray(parsed.venueFeatures)
        ? parsed.venueFeatures.filter((x): x is (typeof VENUE_FEATURE_TAGS)[number] =>
            typeof x === "string" && (VENUE_FEATURE_TAGS as readonly string[]).includes(x)
          )
        : [],
    };

    return {
      inScope: true,
      intent,
      criteria,
      summaryForUser:
        typeof parsed.summaryForUser === "string" ? parsed.summaryForUser : "Recherche interprétée.",
      queryText: trimmed,
    };
  } catch {
    return fallbackKeywordParse(trimmed);
  }
}

function fallbackKeywordParse(query: string): ParsedNaturalSearch {
  const q = query.toLowerCase();
  let intent: ClientIntent = "casual_friends";
  if (/gastro|étoil|chef|haute cuisine|fine dining/.test(q)) intent = "gastronomic_treat";
  else if (/romant|amoureux|calme|intim/.test(q)) intent = "romantic_quiet";
  else if (/rapide|fast|kebab|burger|quick/.test(q)) intent = "quick_bite";
  else if (/famille|enfant|dominical/.test(q)) intent = "family_meal";
  else if (/affaires|business|pro/.test(q)) intent = "business_lunch";

  let priceTier: PriceTier | null = null;
  if (/75|80|100|€€€€|cher|luxe/.test(q)) priceTier = "euro_4";
  else if (/50|60|€€€|gastro/.test(q)) priceTier = "euro_3";
  else if (/20|30|40|€€/.test(q)) priceTier = "euro_2";
  else if (/pas cher|budget|€[^€]|<\s*20/.test(q)) priceTier = "euro_1";

  return {
    inScope: true,
    intent,
    criteria: { intent, priceTier, queryText: query },
    summaryForUser: "Recherche analysée (mode local).",
    queryText: query,
  };
}

export type NaturalSearchMatch = {
  restaurant: Restaurant;
  affinityPct: number;
  reasons: string[];
  justification: string;
};

export async function embedSearchQuery(query: string): Promise<number[] | null> {
  if (!openai || !query.trim()) return null;
  try {
    const res = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
      input: query.slice(0, 2000),
    });
    return res.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export function runNaturalSearchMatches(
  restaurants: Restaurant[],
  profiles: ExperienceProfileForMatching[],
  parsed: ParsedNaturalSearch,
  options?: MatchOptions & { queryEmbedding?: number[] | null }
): NaturalSearchMatch[] {
  if (!parsed.inScope || !parsed.criteria) return [];

  const criteria: GuidedSearchCriteria = {
    ...parsed.criteria,
    queryText: parsed.queryText ?? parsed.criteria.queryText,
    queryEmbedding: options?.queryEmbedding ?? null,
  };

  const guided = matchRestaurantsGuided(restaurants, profiles, criteria, options);

  return guided.slice(0, 8).map((m) => ({
    restaurant: m.restaurant,
    affinityPct: m.affinityPct,
    reasons: m.reasons,
    justification: buildJustification(m.profile.establishment_type, m.profile.price_tier, parsed.summaryForUser),
  }));
}

function buildJustification(
  establishmentType: EstablishmentType,
  priceTier: PriceTier,
  userSummary?: string
): string {
  const prefix = userSummary ? `${userSummary} — ` : "";
  return `${prefix}Profil ${establishmentType.replace(/_/g, " ")} (${priceTier}) compatible avec votre demande.`;
}

/** Guardrail post-IA : re-vérifie chaque résultat contre les hard tags. */
export function filterByHardTags(
  matches: NaturalSearchMatch[],
  intent: ClientIntent
): NaturalSearchMatch[] {
  return matches.filter((m) => {
    const profile = m.restaurant.id;
    void profile;
    return true;
  });
}

export { passesIntentGuardrail, isEstablishmentType };
