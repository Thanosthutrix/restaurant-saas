/**
 * Moteur d'affinité B2C — recherche guidée (sans IA).
 * Les hard tags bloquent les incompatibilités avant le scoring.
 */

import type { Restaurant } from "@/lib/public/types";
import {
  type ClientIntent,
  type EstablishmentType,
  type NoiseLevel,
  type OccasionTag,
  type PriceTier,
  type VenueFeatureTag,
  ESTABLISHMENT_TYPE_BY_VALUE,
  NOISE_LEVELS,
  passesIntentGuardrail,
  priceTierAtLeast,
  priceTierAtMost,
} from "./taxonomy";
import type { ConsumerSearchPreferences } from "./consumerPreferencesDb";
import { consumerPreferenceBoost, passesConsumerPreferences } from "./consumerFilters";

export type ExperienceProfileForMatching = {
  restaurant_id: string;
  establishment_type: EstablishmentType;
  price_tier: PriceTier;
  noise_level: NoiseLevel | null;
  occasions: string[];
  venue_features: string[];
  experience_summary: string | null;
  signature_dish: string | null;
  ai_search_summary: string | null;
  ai_search_keywords?: string[];
  search_embedding?: number[] | null;
};

export type GuidedSearchCriteria = {
  intent: ClientIntent;
  noiseLevel?: NoiseLevel | null;
  priceTier?: PriceTier | null;
  occasions?: OccasionTag[];
  venueFeatures?: VenueFeatureTag[];
  /** Texte libre pour bonus mots-clés / embedding (recherche IA). */
  queryText?: string | null;
  queryEmbedding?: number[] | null;
};

export type MatchOptions = {
  consumerPreferences?: ConsumerSearchPreferences | null;
  minAffinityPct?: number;
};

export type MatchResult = {
  restaurant: Restaurant;
  profile: ExperienceProfileForMatching;
  affinityPct: number;
  reasons: string[];
};

const INTENT_TO_OCCASION: Partial<Record<ClientIntent, OccasionTag>> = {
  romantic_quiet: "romantic",
  business_lunch: "business",
  casual_friends: "friends_party",
  family_meal: "family_sunday",
};

const INTENT_PREFERRED_NOISE: Partial<Record<ClientIntent, NoiseLevel>> = {
  romantic_quiet: "quiet",
  business_lunch: "quiet",
  casual_friends: "lively",
  gastronomic_treat: "quiet",
};

function overlapScore(selected: string[], available: string[]): number {
  if (selected.length === 0) return 0.5;
  const set = new Set(available);
  const hits = selected.filter((s) => set.has(s)).length;
  return hits / selected.length;
}

function priceTierDistance(a: PriceTier, b: PriceTier): number {
  const order = { euro_1: 1, euro_2: 2, euro_3: 3, euro_4: 4 };
  return Math.abs(order[a] - order[b]);
}

function keywordOverlapScore(query: string, profile: ExperienceProfileForMatching): number {
  const q = query.toLowerCase();
  const terms = [
    ...(profile.ai_search_keywords ?? []),
    profile.signature_dish ?? "",
    profile.experience_summary ?? "",
    profile.ai_search_summary ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
    .filter((w) => w.length > 3);
  if (terms.length === 0) return 0;
  const qWords = q.split(/\s+/).filter((w) => w.length > 2);
  let hits = 0;
  for (const w of qWords) {
    if (terms.some((t) => t.includes(w) || w.includes(t))) hits += 1;
  }
  return Math.min(1, hits / Math.max(1, qWords.length));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length !== a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function computeAffinityScore(
  profile: ExperienceProfileForMatching,
  criteria: GuidedSearchCriteria,
  consumerPreferences?: ConsumerSearchPreferences | null
): { pct: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  let weight = 0;

  // Guardrail déjà appliqué en amont — scoring soft
  weight += 30;
  score += 30;
  reasons.push("Compatible avec votre envie");

  const preferredOccasion = INTENT_TO_OCCASION[criteria.intent];
  if (preferredOccasion) {
    weight += 25;
    const occScore = profile.occasions.includes(preferredOccasion) ? 25 : 8;
    score += occScore;
    if (occScore >= 25) reasons.push("Occasion correspondante");
  }

  const preferredNoise = criteria.noiseLevel ?? INTENT_PREFERRED_NOISE[criteria.intent];
  if (preferredNoise && profile.noise_level) {
    weight += 20;
    if (profile.noise_level === preferredNoise) {
      score += 20;
      reasons.push("Ambiance sonore adaptée");
    } else {
      const idxA = NOISE_LEVELS.indexOf(profile.noise_level);
      const idxB = NOISE_LEVELS.indexOf(preferredNoise);
      const prox = 1 - Math.abs(idxA - idxB) / (NOISE_LEVELS.length - 1);
      score += 20 * prox * 0.5;
    }
  }

  if (criteria.priceTier) {
    weight += 15;
    const dist = priceTierDistance(profile.price_tier, criteria.priceTier);
    score += 15 * Math.max(0, 1 - dist / 3);
    if (dist === 0) reasons.push("Budget aligné");
  }

  if (criteria.occasions?.length) {
    weight += 10;
    score += 10 * overlapScore(criteria.occasions, profile.occasions);
  }

  if (criteria.venueFeatures?.length) {
    weight += 10;
    const featScore = overlapScore(criteria.venueFeatures, profile.venue_features);
    score += 10 * featScore;
    if (featScore > 0.5) reasons.push("Atouts du lieu correspondants");
  }

  if (profile.signature_dish?.trim()) {
    reasons.push(`Spécialité : ${profile.signature_dish.trim()}`);
  }

  if (criteria.queryText?.trim()) {
    weight += 15;
    const kw = keywordOverlapScore(criteria.queryText, profile);
    score += 15 * kw;
    if (kw > 0.3) reasons.push("Correspond à votre description");
  }

  if (criteria.queryEmbedding?.length && profile.search_embedding?.length) {
    weight += 15;
    const sim = cosineSimilarity(criteria.queryEmbedding, profile.search_embedding);
    score += 15 * Math.max(0, sim);
    if (sim > 0.75) reasons.push("Forte similarité sémantique");
  }

  const prefBoost = consumerPreferenceBoost(profile, consumerPreferences);
  if (prefBoost.bonus > 0) {
    score += prefBoost.bonus;
    weight += prefBoost.bonus;
    if (prefBoost.reason) reasons.push(prefBoost.reason);
  }

  const pct = weight > 0 ? Math.round((score / weight) * 100) : 0;
  return { pct: Math.min(100, Math.max(0, pct)), reasons: reasons.slice(0, 4) };
}

export function matchRestaurantsGuided(
  restaurants: Restaurant[],
  profiles: ExperienceProfileForMatching[],
  criteria: GuidedSearchCriteria,
  options?: MatchOptions
): MatchResult[] {
  const profileById = new Map(profiles.map((p) => [p.restaurant_id, p]));
  const results: MatchResult[] = [];
  const minPct = options?.minAffinityPct ?? 25;
  const prefs = options?.consumerPreferences;

  for (const restaurant of restaurants) {
    const profile = profileById.get(restaurant.id);
    if (!profile) continue;

    if (!passesConsumerPreferences(profile, prefs)) continue;

    if (
      !passesIntentGuardrail(profile.establishment_type, profile.price_tier, criteria.intent)
    ) {
      continue;
    }

    if (criteria.priceTier) {
      if (!priceTierAtMost(profile.price_tier, criteria.priceTier) && criteria.intent === "quick_bite") {
        continue;
      }
      if (!priceTierAtLeast(profile.price_tier, criteria.priceTier) && criteria.intent === "gastronomic_treat") {
        continue;
      }
    }

    const { pct, reasons } = computeAffinityScore(profile, criteria, prefs);
    if (pct < minPct) continue;

    results.push({ restaurant, profile, affinityPct: pct, reasons });
  }

  return results.sort((a, b) => b.affinityPct - a.affinityPct);
}
