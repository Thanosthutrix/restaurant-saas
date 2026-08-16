/**
 * Taxonomie B2C — profil expérience restaurateur & critères recherche client.
 * Les hard tags (establishment_type, price_tier) forment un plafond non contournable.
 */

export const PRICE_TIERS = ["euro_1", "euro_2", "euro_3", "euro_4"] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  euro_1: "€ — moins de 20 € / pers.",
  euro_2: "€€ — 20 à 40 € / pers.",
  euro_3: "€€€ — 40 à 75 € / pers.",
  euro_4: "€€€€ — plus de 75 € / pers.",
};

export const NOISE_LEVELS = ["quiet", "moderate", "lively"] as const;
export type NoiseLevel = (typeof NOISE_LEVELS)[number];

export const NOISE_LEVEL_LABELS: Record<NoiseLevel, string> = {
  quiet: "Feutré / calme",
  moderate: "Modéré",
  lively: "Dynamique & musique",
};

export const OCCASION_TAGS = [
  "romantic",
  "business",
  "friends_party",
  "family_sunday",
  "solo_work",
] as const;
export type OccasionTag = (typeof OCCASION_TAGS)[number];

export const OCCASION_LABELS: Record<OccasionTag, string> = {
  romantic: "Dîner en amoureux",
  business: "Repas d'affaires",
  friends_party: "Sortie festive entre amis",
  family_sunday: "Repas dominical en famille",
  solo_work: "Solo / work-friendly",
};

export const VENUE_FEATURE_TAGS = [
  "terrace",
  "private_room",
  "panoramic_view",
  "signature_cocktails",
  "parking",
] as const;
export type VenueFeatureTag = (typeof VENUE_FEATURE_TAGS)[number];

export const VENUE_FEATURE_LABELS: Record<VenueFeatureTag, string> = {
  terrace: "Belle terrasse",
  private_room: "Salle privée",
  panoramic_view: "Vue panoramique",
  signature_cocktails: "Cocktails signature",
  parking: "Parking",
};

/** Familles pour le plafond de catégorie (hard guardrail). */
export const ESTABLISHMENT_FAMILIES = [
  "fast_casual",
  "casual_dining",
  "upscale",
  "fine_dining",
  "bar_nightlife",
  "specialty",
] as const;
export type EstablishmentFamily = (typeof ESTABLISHMENT_FAMILIES)[number];

export const ESTABLISHMENT_TYPES = [
  "fast_food",
  "snack",
  "kebab",
  "pizzeria",
  "bistro_brasserie",
  "traditional",
  "gastronomic",
  "tapas_bar",
  "wine_bar",
  "speakeasy",
  "cafe_brunch",
  "seafood",
  "vegetarian_focus",
  "other",
] as const;
export type EstablishmentType = (typeof ESTABLISHMENT_TYPES)[number];

export type EstablishmentTypeDef = {
  value: EstablishmentType;
  label: string;
  family: EstablishmentFamily;
  allowedPriceTiers: PriceTier[];
};

export const ESTABLISHMENT_TYPE_DEFS: EstablishmentTypeDef[] = [
  { value: "fast_food", label: "Fast-food / fast-good", family: "fast_casual", allowedPriceTiers: ["euro_1", "euro_2"] },
  { value: "snack", label: "Snack / street food", family: "fast_casual", allowedPriceTiers: ["euro_1", "euro_2"] },
  { value: "kebab", label: "Kebab / sandwicherie", family: "fast_casual", allowedPriceTiers: ["euro_1", "euro_2"] },
  { value: "pizzeria", label: "Pizzeria", family: "casual_dining", allowedPriceTiers: ["euro_1", "euro_2", "euro_3"] },
  { value: "bistro_brasserie", label: "Bistro / brasserie", family: "casual_dining", allowedPriceTiers: ["euro_2", "euro_3"] },
  { value: "traditional", label: "Restaurant traditionnel", family: "casual_dining", allowedPriceTiers: ["euro_2", "euro_3", "euro_4"] },
  { value: "gastronomic", label: "Gastronomique", family: "fine_dining", allowedPriceTiers: ["euro_3", "euro_4"] },
  { value: "tapas_bar", label: "Bar à tapas", family: "casual_dining", allowedPriceTiers: ["euro_2", "euro_3"] },
  { value: "wine_bar", label: "Bar à vins / cave à manger", family: "upscale", allowedPriceTiers: ["euro_2", "euro_3", "euro_4"] },
  { value: "speakeasy", label: "Speakeasy / cocktail bar", family: "bar_nightlife", allowedPriceTiers: ["euro_2", "euro_3", "euro_4"] },
  { value: "cafe_brunch", label: "Café / brunch", family: "casual_dining", allowedPriceTiers: ["euro_1", "euro_2"] },
  { value: "seafood", label: "Fruits de mer / poissonnerie", family: "upscale", allowedPriceTiers: ["euro_2", "euro_3", "euro_4"] },
  { value: "vegetarian_focus", label: "Végétarien / veggie focus", family: "specialty", allowedPriceTiers: ["euro_1", "euro_2", "euro_3"] },
  { value: "other", label: "Autre", family: "casual_dining", allowedPriceTiers: ["euro_1", "euro_2", "euro_3", "euro_4"] },
];

export const ESTABLISHMENT_TYPE_BY_VALUE = Object.fromEntries(
  ESTABLISHMENT_TYPE_DEFS.map((d) => [d.value, d])
) as Record<EstablishmentType, EstablishmentTypeDef>;

export const CLIENT_INTENTS = [
  "romantic_quiet",
  "gastronomic_treat",
  "casual_friends",
  "family_meal",
  "quick_bite",
  "business_lunch",
] as const;
export type ClientIntent = (typeof CLIENT_INTENTS)[number];

export const CLIENT_INTENT_LABELS: Record<ClientIntent, string> = {
  romantic_quiet: "Dîner romantique & calme",
  gastronomic_treat: "Expérience gastronomique",
  casual_friends: "Entre amis, ambiance conviviale",
  family_meal: "Repas en famille",
  quick_bite: "Repas rapide / casual",
  business_lunch: "Repas d'affaires",
};

export const INTENT_EXCLUDED_FAMILIES: Record<ClientIntent, EstablishmentFamily[]> = {
  romantic_quiet: ["fast_casual", "bar_nightlife"],
  gastronomic_treat: ["fast_casual", "bar_nightlife"],
  casual_friends: [],
  family_meal: ["bar_nightlife"],
  quick_bite: ["fine_dining", "upscale"],
  business_lunch: ["fast_casual", "bar_nightlife"],
};

export const INTENT_MIN_PRICE_TIER: Partial<Record<ClientIntent, PriceTier>> = {
  gastronomic_treat: "euro_3",
  romantic_quiet: "euro_2",
  business_lunch: "euro_2",
};

export const INTENT_MAX_PRICE_TIER: Partial<Record<ClientIntent, PriceTier>> = {
  quick_bite: "euro_2",
};

const PRICE_TIER_ORDER: Record<PriceTier, number> = {
  euro_1: 1,
  euro_2: 2,
  euro_3: 3,
  euro_4: 4,
};

export function priceTierAtLeast(tier: PriceTier, min: PriceTier): boolean {
  return PRICE_TIER_ORDER[tier] >= PRICE_TIER_ORDER[min];
}

export function priceTierAtMost(tier: PriceTier, max: PriceTier): boolean {
  return PRICE_TIER_ORDER[tier] <= PRICE_TIER_ORDER[max];
}

export function isEstablishmentType(value: string): value is EstablishmentType {
  return (ESTABLISHMENT_TYPES as readonly string[]).includes(value);
}

export function isPriceTier(value: string): value is PriceTier {
  return (PRICE_TIERS as readonly string[]).includes(value);
}

export function isNoiseLevel(value: string): value is NoiseLevel {
  return (NOISE_LEVELS as readonly string[]).includes(value);
}

export function validateExperienceHardTags(
  establishmentType: string,
  priceTier: string
): { ok: true } | { ok: false; error: string } {
  if (!isEstablishmentType(establishmentType)) {
    return { ok: false, error: "Type d'établissement invalide." };
  }
  if (!isPriceTier(priceTier)) {
    return { ok: false, error: "Ticket moyen invalide." };
  }
  const def = ESTABLISHMENT_TYPE_BY_VALUE[establishmentType];
  if (!def.allowedPriceTiers.includes(priceTier)) {
    return {
      ok: false,
      error: `Ce ticket moyen n'est pas compatible avec « ${def.label} ».`,
    };
  }
  return { ok: true };
}

export function passesIntentGuardrail(
  establishmentType: EstablishmentType,
  priceTier: PriceTier,
  intent: ClientIntent
): boolean {
  const def = ESTABLISHMENT_TYPE_BY_VALUE[establishmentType];
  if (INTENT_EXCLUDED_FAMILIES[intent].includes(def.family)) return false;

  const minTier = INTENT_MIN_PRICE_TIER[intent];
  if (minTier && !priceTierAtLeast(priceTier, minTier)) return false;

  const maxTier = INTENT_MAX_PRICE_TIER[intent];
  if (maxTier && !priceTierAtMost(priceTier, maxTier)) return false;

  return true;
}
