"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantMembership } from "@/lib/auth/restaurantActionAccess";
import {
  getExperienceProfile,
  listExperienceProfilesForPublicRestaurants,
  upsertExperienceProfile,
} from "@/lib/b2c/experience/experienceDb";
import {
  type EstablishmentType,
  type NoiseLevel,
  type OccasionTag,
  type PriceTier,
  type VenueFeatureTag,
  validateExperienceHardTags,
  OCCASION_TAGS,
  VENUE_FEATURE_TAGS,
} from "@/lib/b2c/experience/taxonomy";
import {
  type GuidedSearchCriteria,
  matchRestaurantsGuided,
} from "@/lib/b2c/experience/matching";
import { getConsumerSearchPreferences } from "@/lib/b2c/experience/consumerPreferencesDb";
import { listPublicRestaurants } from "@/lib/public/data";
import { refreshExperienceProfileAi } from "@/lib/b2c/experience/refreshProfileAi";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function sanitizeMulti<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const set = new Set(allowed as readonly string[]);
  return values.filter((v) => set.has(v)) as T[];
}

export async function fetchExperienceProfileAction(
  restaurantId: string
): Promise<ActionResult<Awaited<ReturnType<typeof getExperienceProfile>>["data"]>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantMembership(user.id, restaurantId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const { data, error } = await getExperienceProfile(restaurantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function saveExperienceProfileAction(params: {
  restaurantId: string;
  establishmentType: string;
  priceTier: string;
  noiseLevel: string | null;
  occasions: string[];
  venueFeatures: string[];
  experienceSummary: string;
  signatureDish: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantMembership(user.id, params.restaurantId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const hard = validateExperienceHardTags(params.establishmentType, params.priceTier);
  if (!hard.ok) return hard;

  const noiseLevel =
    params.noiseLevel && ["quiet", "moderate", "lively"].includes(params.noiseLevel)
      ? (params.noiseLevel as NoiseLevel)
      : null;

  const { error } = await upsertExperienceProfile({
    restaurantId: params.restaurantId,
    establishmentType: params.establishmentType as EstablishmentType,
    priceTier: params.priceTier as PriceTier,
    noiseLevel,
    occasions: sanitizeMulti(params.occasions, OCCASION_TAGS),
    venueFeatures: sanitizeMulti(params.venueFeatures, VENUE_FEATURE_TAGS),
    experienceSummary: params.experienceSummary,
    signatureDish: params.signatureDish,
    markCompleted: true,
  });

  if (error) return { ok: false, error: error.message };

  void refreshExperienceProfileAi(params.restaurantId).catch(() => undefined);

  revalidatePath("/dashboard");
  revalidatePath("/restaurants/[id]/edit", "page");
  revalidatePath("/");
  return { ok: true };
}

export type GuidedMatchResult = {
  restaurantId: string;
  affinityPct: number;
  reasons: string[];
};

export async function guidedSearchAction(
  criteria: GuidedSearchCriteria
): Promise<ActionResult<{ matches: GuidedMatchResult[] }>> {
  const user = await getCurrentUser();
  const consumerPrefs = user ? await getConsumerSearchPreferences(user.id) : null;

  const restaurants = await listPublicRestaurants();
  const ids = restaurants.map((r) => r.id);
  const { data: profiles, error: profErr } = await listExperienceProfilesForPublicRestaurants(ids);
  if (profErr) return { ok: false, error: profErr.message };

  const matches = matchRestaurantsGuided(
    restaurants,
    profiles,
    {
      ...criteria,
      noiseLevel: criteria.noiseLevel ?? consumerPrefs?.preferred_noise_level ?? null,
      priceTier: criteria.priceTier ?? consumerPrefs?.max_price_tier ?? null,
      occasions: criteria.occasions?.length ? criteria.occasions : consumerPrefs?.preferred_occasions,
    },
    { consumerPreferences: consumerPrefs }
  );
  return {
    ok: true,
    data: {
      matches: matches.map((m) => ({
        restaurantId: m.restaurant.id,
        affinityPct: m.affinityPct,
        reasons: m.reasons,
      })),
    },
  };
}
