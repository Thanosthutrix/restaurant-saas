/**
 * Normalise un nom de composant pour le matching (éviter doublons type "Mozzarella" / "mozzarella").
 * lowercase, trim, suppression accents, ponctuation → espaces, collapse espaces.
 */
export function normalizeInventoryItemName(input: string): string {
  if (!input || typeof input !== "string") return "";
  let s = input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}
