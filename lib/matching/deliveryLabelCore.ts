import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";

/** Réduit les préfixes type code article / ref en tête de ligne BL. */
export function stripLeadingNoise(normalized: string): string {
  let s = normalized.trim();
  s = s.replace(/^\d+[\s\-–—]*\d*\s+/, "");
  s = s.replace(/^[a-z]{1,4}\d{3,}\s+/i, "");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Retire en fin de libellé : quantités, unités, codes entrepôt courants (1K, BDF, etc.).
 * Permet de rapprocher « confiture fraise 1K BDF » de « confiture fraise » en stock.
 */
export function stripTrailingPackagingNoise(normalized: string): string {
  let s = normalized.trim().replace(/\s+/g, " ");
  let prev = "";
  let guard = 0;
  while (s !== prev && guard++ < 12) {
    prev = s;
    s = s
      .replace(/\s+\d+[,.]?\d*\s*(kg|g|k|l|ml|cl|unit|units|pcs|pce|u)\b\s*$/i, "")
      .replace(/\s+\d+k\b\s*$/i, "")
      .replace(/\s+\d+[,.]?\d*\s*$/i, "")
      .replace(
        /\s+\b(?:bdf|ref|lot|pvc|pet|sac|col|ctn|pal|bac|box|pc|pcs|sku|ean)\b\s*$/i,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();
  }
  return s;
}

/** Cœur de libellé pour rapprochement stock et mémorisation fournisseur. */
export function computeDeliveryLabelCore(rawLabel: string): string {
  const n = normalizeInventoryItemName(rawLabel);
  return stripTrailingPackagingNoise(stripLeadingNoise(n));
}
