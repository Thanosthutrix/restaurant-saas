import { toNumber } from "@/lib/utils/safeNumeric";

export function mergeSalesByDish(
  lines: { dish_id: string; qty: unknown }[]
): { dish_id: string; qty: number }[] {
  const map = new Map<string, number>();
  for (const l of lines) {
    const q = toNumber(l.qty);
    if (q <= 0) continue;
    map.set(l.dish_id, (map.get(l.dish_id) ?? 0) + q);
  }
  return [...map.entries()].map(([dish_id, qty]) => ({ dish_id, qty }));
}
