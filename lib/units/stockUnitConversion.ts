import type { AllowedUnit } from "@/lib/constants";

/**
 * Facteur pour convertir une quantité exprimée dans `fromUnit` vers `toUnit`
 * (même grandeur physique : masse ou volume).
 * Ex. ml → l : multiplier la quantité par 1/1000.
 * Retourne null si pas de conversion définie (unités identiques → 1).
 */
export function stockUnitQtyScaleFactor(fromUnit: AllowedUnit, toUnit: AllowedUnit): number | null {
  if (fromUnit === toUnit) return 1;
  const pairs: [AllowedUnit, AllowedUnit, number][] = [
    ["ml", "l", 1 / 1000],
    ["l", "ml", 1000],
    ["g", "kg", 1 / 1000],
    ["kg", "g", 1000],
  ];
  for (const [a, b, f] of pairs) {
    if (fromUnit === a && toUnit === b) return f;
  }
  return null;
}

export function roundRecipeQty(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e6) / 1e6;
}
