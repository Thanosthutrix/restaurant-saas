const STOP_WORDS = new Set([
  "pizza",
  "pizzas",
  "menu",
  "menus",
  "plat",
  "plats",
  "article",
  "art",
]);

/** Mots pour lesquels on ne crée pas d'alias (garde-fou). */
export const ALIAS_FORBIDDEN_NORMALIZED = new Set([
  "menu",
  "menus",
  "plat",
  "plats",
  "boisson",
  "dessert",
  "formule",
  "supplement",
]);

/**
 * Normalise un libellé plat pour comparaison et matching.
 * 1. lowercase 2. trim 3. suppression accents 4. ponctuation → espaces
 * 5. collapse espaces 6. suppression stop words
 */
export function normalizeDishLabel(input: string): string {
  if (!input || typeof input !== "string") return "";
  let s = input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  const words = s.split(" ").filter((w) => w && !STOP_WORDS.has(w));
  return words.join(" ");
}
