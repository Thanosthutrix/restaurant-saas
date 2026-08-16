import type { EstablishmentType, PriceTier } from "./taxonomy";

/** Préremplit le profil expérience depuis le template ERP choisi à l'onboarding. */
export function suggestExperienceFromTemplate(
  templateSlug: string | null | undefined
): { establishmentType: EstablishmentType; priceTier: PriceTier } {
  const slug = templateSlug?.trim() ?? "";
  const map: Record<string, { establishmentType: EstablishmentType; priceTier: PriceTier }> = {
    pizzeria: { establishmentType: "pizzeria", priceTier: "euro_2" },
    "snack-fastfood": { establishmentType: "fast_food", priceTier: "euro_1" },
    "brasserie-traditionnel": { establishmentType: "bistro_brasserie", priceTier: "euro_2" },
    "boulangerie-patisserie": { establishmentType: "cafe_brunch", priceTier: "euro_1" },
    "bar-cafe": { establishmentType: "cafe_brunch", priceTier: "euro_2" },
    "glacier-crepe-gaufre": { establishmentType: "snack", priceTier: "euro_1" },
  };
  return map[slug] ?? { establishmentType: "traditional", priceTier: "euro_2" };
}
