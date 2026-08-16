import { supabaseServer } from "@/lib/supabaseServer";
import type {
  EstablishmentType,
  NoiseLevel,
  OccasionTag,
  PriceTier,
  VenueFeatureTag,
} from "./taxonomy";
import {
  isEstablishmentType,
  isNoiseLevel,
  isPriceTier,
  OCCASION_TAGS,
  VENUE_FEATURE_TAGS,
} from "./taxonomy";
import type { ExperienceProfileForMatching } from "./matching";

export type RestaurantExperienceProfile = ExperienceProfileForMatching & {
  completed_at: string | null;
  declarative_updated_at: string;
  ai_last_refreshed_at: string | null;
  ai_search_keywords: string[];
  factual_snapshot: Record<string, unknown>;
};

function sanitizeTags<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const set = new Set(allowed as readonly string[]);
  return values.filter((v) => set.has(v)) as T[];
}

export async function getExperienceProfile(
  restaurantId: string
): Promise<{ data: RestaurantExperienceProfile | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("restaurant_experience_profiles")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  const row = data as Record<string, unknown>;
  if (!isEstablishmentType(String(row.establishment_type)) || !isPriceTier(String(row.price_tier))) {
    return { data: null, error: new Error("Profil expérience corrompu.") };
  }

  return {
    data: {
      restaurant_id: String(row.restaurant_id),
      establishment_type: row.establishment_type as EstablishmentType,
      price_tier: row.price_tier as PriceTier,
      noise_level: row.noise_level && isNoiseLevel(String(row.noise_level))
        ? (row.noise_level as NoiseLevel)
        : null,
      occasions: sanitizeTags((row.occasions as string[]) ?? [], OCCASION_TAGS),
      venue_features: sanitizeTags((row.venue_features as string[]) ?? [], VENUE_FEATURE_TAGS),
      experience_summary: row.experience_summary ? String(row.experience_summary) : null,
      signature_dish: row.signature_dish ? String(row.signature_dish) : null,
      ai_search_summary: row.ai_search_summary ? String(row.ai_search_summary) : null,
      completed_at: row.completed_at ? String(row.completed_at) : null,
      declarative_updated_at: String(row.declarative_updated_at),
      ai_last_refreshed_at: row.ai_last_refreshed_at ? String(row.ai_last_refreshed_at) : null,
      ai_search_keywords: (row.ai_search_keywords as string[]) ?? [],
      factual_snapshot: (row.factual_snapshot as Record<string, unknown>) ?? {},
    },
    error: null,
  };
}

export async function listExperienceProfilesForPublicRestaurants(
  restaurantIds: string[]
): Promise<{ data: ExperienceProfileForMatching[]; error: Error | null }> {
  if (restaurantIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabaseServer
    .from("restaurant_experience_profiles")
    .select(
      "restaurant_id, establishment_type, price_tier, noise_level, occasions, venue_features, experience_summary, signature_dish, ai_search_summary, ai_search_keywords, search_embedding"
    )
    .in("restaurant_id", restaurantIds)
    .not("completed_at", "is", null);

  if (error) return { data: [], error: new Error(error.message) };

  const profiles: ExperienceProfileForMatching[] = [];
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    if (!isEstablishmentType(String(r.establishment_type)) || !isPriceTier(String(r.price_tier))) continue;
    profiles.push({
      restaurant_id: String(r.restaurant_id),
      establishment_type: r.establishment_type as EstablishmentType,
      price_tier: r.price_tier as PriceTier,
      noise_level: r.noise_level && isNoiseLevel(String(r.noise_level))
        ? (r.noise_level as NoiseLevel)
        : null,
      occasions: sanitizeTags((r.occasions as string[]) ?? [], OCCASION_TAGS),
      venue_features: sanitizeTags((r.venue_features as string[]) ?? [], VENUE_FEATURE_TAGS),
      experience_summary: r.experience_summary ? String(r.experience_summary) : null,
      signature_dish: r.signature_dish ? String(r.signature_dish) : null,
      ai_search_summary: r.ai_search_summary ? String(r.ai_search_summary) : null,
      ai_search_keywords: (r.ai_search_keywords as string[]) ?? [],
      search_embedding: Array.isArray(r.search_embedding)
        ? (r.search_embedding as number[])
        : null,
    });
  }

  return { data: profiles, error: null };
}

export async function upsertExperienceProfile(params: {
  restaurantId: string;
  establishmentType: EstablishmentType;
  priceTier: PriceTier;
  noiseLevel: NoiseLevel | null;
  occasions: OccasionTag[];
  venueFeatures: VenueFeatureTag[];
  experienceSummary: string | null;
  signatureDish: string | null;
  markCompleted?: boolean;
}): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const payload = {
    restaurant_id: params.restaurantId,
    establishment_type: params.establishmentType,
    price_tier: params.priceTier,
    noise_level: params.noiseLevel,
    occasions: params.occasions,
    venue_features: params.venueFeatures,
    experience_summary: params.experienceSummary?.trim() || null,
    signature_dish: params.signatureDish?.trim() || null,
    declarative_updated_at: now,
    completed_at: params.markCompleted !== false ? now : null,
  };

  const { error } = await supabaseServer
    .from("restaurant_experience_profiles")
    .upsert(payload, { onConflict: "restaurant_id" });

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
