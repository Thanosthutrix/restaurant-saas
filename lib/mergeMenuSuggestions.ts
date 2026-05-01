import type { MenuSuggestionItem, MenuSuggestionMode } from "@/lib/menuSuggestionTypes";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";

function pickMode(a: MenuSuggestionMode, b: MenuSuggestionMode): MenuSuggestionMode {
  if (a === "prepared" || b === "prepared") return "prepared";
  if (a === "resale" || b === "resale") return "resale";
  return "ignore";
}

function pickTtc(
  a: number | null | undefined,
  b: number | null | undefined,
  legacyA?: number | null | undefined,
  legacyB?: number | null | undefined
): number | null {
  const fa = a != null && Number.isFinite(a) ? a : null;
  const fb = b != null && Number.isFinite(b) ? b : null;
  const la = legacyA != null && Number.isFinite(legacyA) ? legacyA : null;
  const lb = legacyB != null && Number.isFinite(legacyB) ? legacyB : null;
  if (fa != null) return fa;
  if (fb != null) return fb;
  if (la != null) return la;
  if (lb != null) return lb;
  return null;
}

function pickVat(
  a: number | null | undefined,
  b: number | null | undefined,
  mode: MenuSuggestionMode
): number {
  const fa = a != null && Number.isFinite(a) && a >= 0 && a <= 100 ? a : null;
  const fb = b != null && Number.isFinite(b) && b >= 0 && b <= 100 ? b : null;
  if (fa != null) return fa;
  if (fb != null) return fb;
  return mode === "resale" ? 20 : 10;
}

function pickCategory(a?: string | null, b?: string | null): string | null {
  const ca = a?.trim();
  if (ca) return ca;
  const cb = b?.trim();
  return cb || null;
}

/**
 * Fusionne les suggestions issues de plusieurs photos (même plat sur plusieurs pages).
 */
export function mergeMenuSuggestionsByNormalizedLabel(items: MenuSuggestionItem[]): MenuSuggestionItem[] {
  const map = new Map<string, MenuSuggestionItem>();
  for (const row of items) {
    const key = (row.normalized_label || normalizeDishLabel(row.raw_label)).trim();
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      const mode = row.suggested_mode;
      map.set(key, {
        ...row,
        selling_price_ttc: pickTtc(row.selling_price_ttc, null, row.selling_price_ht, null),
        selling_vat_rate_pct: pickVat(row.selling_vat_rate_pct, null, mode),
        selling_price_ht: undefined,
      });
      continue;
    }
    const ingredients = [...new Set([...existing.suggested_ingredients, ...row.suggested_ingredients])];
    const mergedMode = pickMode(existing.suggested_mode, row.suggested_mode);
    map.set(key, {
      ...existing,
      raw_label: existing.raw_label.length >= row.raw_label.length ? existing.raw_label : row.raw_label,
      normalized_label: key,
      suggested_mode: mergedMode,
      suggested_ingredients: ingredients,
      suggested_category: pickCategory(existing.suggested_category, row.suggested_category),
      selling_price_ttc: pickTtc(
        existing.selling_price_ttc,
        row.selling_price_ttc,
        existing.selling_price_ht,
        row.selling_price_ht
      ),
      selling_vat_rate_pct: pickVat(
        existing.selling_vat_rate_pct,
        row.selling_vat_rate_pct,
        mergedMode
      ),
      selling_price_ht: undefined,
      confidence:
        existing.confidence != null && row.confidence != null
          ? Math.max(existing.confidence, row.confidence)
          : (existing.confidence ?? row.confidence),
    });
  }
  return [...map.values()];
}
