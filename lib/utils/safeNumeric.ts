/**
 * Conversion sûre d'une valeur renvoyée par Supabase (numeric peut être string ou number)
 * en number. Utiliser partout où une quantité ou un nombre vient de la base.
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
