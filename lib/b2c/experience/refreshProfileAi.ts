/**
 * Rafraîchissement IA hebdomadaire du profil expérience (avis + carte + déclaratif).
 */

import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { getExperienceProfile } from "./experienceDb";
import { buildFactualSnapshot } from "./factualSnapshot";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const model = () => process.env.OPENAI_B2C_EXPERIENCE_MODEL?.trim() || "gpt-4o-mini";
const embedModel = () => process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

export type RefreshResult = {
  restaurantId: string;
  ok: boolean;
  error?: string;
};

const SYSTEM = `Tu synthétises le profil recherche B2C d'un restaurant partenaire ubion (France).
Réponds UNIQUEMENT en JSON :
{
  "ai_search_summary": "2-3 phrases factuelles pour aider un client à choisir",
  "ai_search_keywords": ["mot-clé1", "mot-clé2", ... max 15]
}
Règles :
- Ne contredis JAMAIS le type d'établissement ni le ticket déclarés (hard tags).
- Utilise les avis récents et la carte pour enrichir, pas pour réinventer le positionnement.
- Mots-clés en français, courts, utiles pour la recherche.`;

async function embedText(text: string): Promise<number[] | null> {
  if (!openai || !text.trim()) return null;
  try {
    const res = await openai.embeddings.create({
      model: embedModel(),
      input: text.slice(0, 8000),
    });
    return res.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export async function refreshExperienceProfileAi(restaurantId: string): Promise<RefreshResult> {
  const { data: profile, error: loadErr } = await getExperienceProfile(restaurantId);
  if (loadErr) return { restaurantId, ok: false, error: loadErr.message };
  if (!profile?.completed_at) {
    return { restaurantId, ok: false, error: "Profil expérience non complété." };
  }

  const factual = await buildFactualSnapshot(restaurantId);
  const now = new Date().toISOString();

  let aiSummary = profile.ai_search_summary ?? "";
  let keywords = profile.ai_search_keywords ?? [];

  const payload = {
    hardTags: {
      establishment_type: profile.establishment_type,
      price_tier: profile.price_tier,
      noise_level: profile.noise_level,
      occasions: profile.occasions,
    },
    declarative: {
      experience_summary: profile.experience_summary,
      signature_dish: profile.signature_dish,
    },
    factual,
  };

  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: model(),
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
      });
      const raw = completion.choices[0]?.message?.content;
      if (raw) {
        const parsed = JSON.parse(raw) as {
          ai_search_summary?: string;
          ai_search_keywords?: string[];
        };
        if (typeof parsed.ai_search_summary === "string") {
          aiSummary = parsed.ai_search_summary.trim().slice(0, 2000);
        }
        if (Array.isArray(parsed.ai_search_keywords)) {
          keywords = parsed.ai_search_keywords
            .filter((k) => typeof k === "string" && k.trim().length > 1)
            .map((k) => k.trim().slice(0, 60))
            .slice(0, 15);
        }
      }
    } catch (e) {
      console.warn("[refreshExperienceProfileAi] OpenAI chat", restaurantId, e);
    }
  } else {
    keywords = [
      profile.signature_dish?.trim(),
      ...factual.signatureMenuItems.slice(0, 5),
      profile.establishment_type.replace(/_/g, " "),
    ].filter(Boolean) as string[];
    aiSummary =
      profile.experience_summary?.trim() ||
      `${factual.restaurantName} — ${factual.budgetLabel}. ${factual.publicDishCount} plats publics.`;
  }

  const embedSource = [
    aiSummary,
    profile.experience_summary,
    profile.signature_dish,
    keywords.join(" "),
  ]
    .filter(Boolean)
    .join("\n");
  const embedding = await embedText(embedSource);

  const { error: upErr } = await supabaseServer
    .from("restaurant_experience_profiles")
    .update({
      ai_search_summary: aiSummary || null,
      ai_search_keywords: keywords,
      ai_last_refreshed_at: now,
      factual_snapshot: factual,
      search_embedding: embedding,
    })
    .eq("restaurant_id", restaurantId);

  if (upErr) return { restaurantId, ok: false, error: upErr.message };
  return { restaurantId, ok: true };
}

export async function refreshAllExperienceProfiles(): Promise<{
  total: number;
  ok: number;
  errors: string[];
}> {
  const { data: rows, error } = await supabaseServer
    .from("restaurant_experience_profiles")
    .select("restaurant_id")
    .not("completed_at", "is", null);

  if (error) return { total: 0, ok: 0, errors: [error.message] };

  const ids = (rows ?? []).map((r) => String((r as { restaurant_id: string }).restaurant_id));
  let ok = 0;
  const errors: string[] = [];

  for (const id of ids) {
    const res = await refreshExperienceProfileAi(id);
    if (res.ok) ok += 1;
    else if (res.error) errors.push(`${id}: ${res.error}`);
  }

  return { total: ids.length, ok, errors };
}
