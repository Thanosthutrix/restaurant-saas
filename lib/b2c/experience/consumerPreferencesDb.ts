import { supabaseServer } from "@/lib/supabaseServer";
import type { ClientIntent, EstablishmentType, NoiseLevel, OccasionTag, PriceTier } from "./taxonomy";
import { CLIENT_INTENTS, isEstablishmentType, isNoiseLevel, isPriceTier, OCCASION_TAGS } from "./taxonomy";

export type ConsumerSearchPreferences = {
  user_id: string;
  excluded_establishment_types: EstablishmentType[];
  default_intent: ClientIntent | null;
  preferred_noise_level: NoiseLevel | null;
  min_price_tier: PriceTier | null;
  max_price_tier: PriceTier | null;
  preferred_occasions: OccasionTag[];
  onboarding_completed_at: string | null;
};

function mapRow(row: Record<string, unknown>): ConsumerSearchPreferences {
  return {
    user_id: String(row.user_id),
    excluded_establishment_types: ((row.excluded_establishment_types as string[]) ?? []).filter(
      isEstablishmentType
    ),
    default_intent: CLIENT_INTENTS.includes(row.default_intent as ClientIntent)
      ? (row.default_intent as ClientIntent)
      : null,
    preferred_noise_level:
      row.preferred_noise_level && isNoiseLevel(String(row.preferred_noise_level))
        ? (row.preferred_noise_level as NoiseLevel)
        : null,
    min_price_tier:
      row.min_price_tier && isPriceTier(String(row.min_price_tier))
        ? (row.min_price_tier as PriceTier)
        : null,
    max_price_tier:
      row.max_price_tier && isPriceTier(String(row.max_price_tier))
        ? (row.max_price_tier as PriceTier)
        : null,
    preferred_occasions: ((row.preferred_occasions as string[]) ?? []).filter((o) =>
      (OCCASION_TAGS as readonly string[]).includes(o)
    ) as OccasionTag[],
    onboarding_completed_at: row.onboarding_completed_at ? String(row.onboarding_completed_at) : null,
  };
}

export async function getConsumerSearchPreferences(
  userId: string
): Promise<ConsumerSearchPreferences | null> {
  const { data, error } = await supabaseServer
    .from("consumer_search_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function upsertConsumerSearchPreferences(input: {
  userId: string;
  excludedEstablishmentTypes: EstablishmentType[];
  defaultIntent: ClientIntent | null;
  preferredNoiseLevel: NoiseLevel | null;
  minPriceTier: PriceTier | null;
  maxPriceTier: PriceTier | null;
  preferredOccasions: OccasionTag[];
  markOnboardingComplete?: boolean;
}): Promise<ConsumerSearchPreferences | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("consumer_search_preferences")
    .upsert(
      {
        user_id: input.userId,
        excluded_establishment_types: input.excludedEstablishmentTypes,
        default_intent: input.defaultIntent,
        preferred_noise_level: input.preferredNoiseLevel,
        min_price_tier: input.minPriceTier,
        max_price_tier: input.maxPriceTier,
        preferred_occasions: input.preferredOccasions,
        onboarding_completed_at: input.markOnboardingComplete !== false ? now : null,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}
