import type { Dish } from "@/lib/db";

/** Normalise pour la comparaison : minuscules, sans accents, sans préfixe "pizza". */
export function normalizeForMatch(s: string): string {
  const lower = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return lower.replace(/^\s*pizza\s+/, "").trim();
}

/**
 * Trouve le plat qui correspond le mieux à l'item extrait du ticket.
 * Compare en normalisé (accents, casse, préfixe "Pizza" ignorés).
 */
export function matchItemToDish(
  itemName: string,
  dishes: Dish[]
): Dish | null {
  if (!itemName.trim() || dishes.length === 0) return null;
  const itemNorm = normalizeForMatch(itemName);
  if (!itemNorm) return null;

  for (const dish of dishes) {
    const dishNorm = normalizeForMatch(dish.name);
    if (!dishNorm) continue;
    if (dishNorm === itemNorm) return dish;
    if (dishNorm.includes(itemNorm) || itemNorm.includes(dishNorm)) return dish;
  }
  return null;
}

/**
 * Fusionne les ventes manuelles et les ventes analysées (par dish_id, qtés additionnées).
 */
export function mergeSales(
  manual: { dish_id: string; qty: number }[],
  analyzed: { dish_id: string; qty: number }[]
): { dish_id: string; qty: number }[] {
  const byDish = new Map<string, number>();
  for (const { dish_id, qty } of manual) {
    if (qty > 0) byDish.set(dish_id, (byDish.get(dish_id) ?? 0) + qty);
  }
  for (const { dish_id, qty } of analyzed) {
    if (qty > 0) byDish.set(dish_id, (byDish.get(dish_id) ?? 0) + qty);
  }
  return Array.from(byDish.entries()).map(([dish_id, qty]) => ({ dish_id, qty }));
}
