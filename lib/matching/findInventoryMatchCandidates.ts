import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { stringSimilarity } from "./stringSimilarity";
import {
  computeDeliveryLabelCore,
  stripLeadingNoise,
  stripTrailingPackagingNoise,
} from "./deliveryLabelCore";

export { computeDeliveryLabelCore } from "./deliveryLabelCore";

const SCORE_EXACT = 100;
/** Le nom stock contient tout le libellé BL (ou l’inverse). */
const SCORE_STOCK_CONTAINS_LABEL = 52;
const SCORE_LABEL_CONTAINS_STOCK = 48;
const SCORE_PER_COMMON_WORD = 15;
/** Plafond pour les scores fuzzy (chaîne entière ou mots triés). */
const SCORE_FUZZY_MAX = 90;

/** En dessous : pas d’auto-liaison côté import BL. */
export const INVENTORY_BL_AUTO_LINK_MIN = 62;
/** Si le 2ᵉ candidat est trop proche du 1ᵉʳ, on n’auto-lie pas (évite les homonymes). */
const AMBIGUITY_GAP = 3;

/** Mots courts FR peu utiles pour le score par intersection. */
const STOP_WORDS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "au",
  "aux",
  "et",
  "a",
  "en",
  "un",
  "une",
  "the",
]);

function meaningfulWords(normalized: string): Set<string> {
  const words = normalized.split(" ").filter(Boolean);
  const out = new Set<string>();
  for (const w of words) {
    if (w.length < 2) continue;
    if (w.length <= 3 && STOP_WORDS.has(w)) continue;
    out.add(w);
  }
  return out;
}

function tokenSortedJoined(normalized: string): string {
  return [...normalized.split(" ")].filter(Boolean).sort().join(" ");
}

/**
 * Combine plusieurs signaux (comme les plats + extras stock).
 * Utilise un libellé « cœur » (sans codes type 1K, BDF) pour coller au nom stock.
 */
function scoreLabelAgainstStock(
  normalizedLabel: string,
  stockNorm: string
): { score: number; reason: string } {
  const label = stripTrailingPackagingNoise(stripLeadingNoise(normalizedLabel));
  const stock = stockNorm;

  if (stock === label) return { score: SCORE_EXACT, reason: "exact" };

  const labelWords = meaningfulWords(label);
  const stockWords = meaningfulWords(stock);

  let score = 0;
  let reason = "";

  if (stock.includes(label) && label.length >= 2) {
    score = SCORE_STOCK_CONTAINS_LABEL;
    reason = "stock contains label";
  } else if (label.includes(stock) && stock.length >= 2) {
    score = SCORE_LABEL_CONTAINS_STOCK;
    reason = "label contains stock";
  }

  const common = [...labelWords].filter((w) => stockWords.has(w));
  if (common.length > 0) {
    const union = new Set([...labelWords, ...stockWords]);
    const jacc = union.size > 0 ? common.length / union.size : 0;
    const tokenScore = Math.round(common.length * SCORE_PER_COMMON_WORD + jacc * 52);
    if (tokenScore > score) {
      score = tokenScore;
      reason = "tokens+jaccard";
    }
  }

  for (const w of labelWords) {
    if (w.length >= 3 && stock.includes(w)) {
      const sub = 40 + Math.min(22, w.length * 2);
      if (sub > score) {
        score = sub;
        reason = "substring";
      }
    }
  }
  for (const w of stockWords) {
    if (w.length >= 3 && label.includes(w)) {
      const sub = 40 + Math.min(22, w.length * 2);
      if (sub > score) {
        score = sub;
        reason = "substring";
      }
    }
  }

  const fuzzRaw = Math.floor(stringSimilarity(label, stock) * SCORE_FUZZY_MAX);
  const fuzzSorted = Math.floor(
    stringSimilarity(tokenSortedJoined(label), tokenSortedJoined(stock)) * SCORE_FUZZY_MAX
  );
  const fuzzMax = Math.max(fuzzRaw, fuzzSorted);
  if (fuzzMax > score) {
    score = fuzzMax;
    reason = fuzzSorted > fuzzRaw ? "fuzzy words order" : "fuzzy";
  }

  return { score, reason };
}

export type InventoryCandidate = {
  id: string;
  name: string;
  score: number;
  reason: string;
};

export type InventoryMatchResult = {
  normalizedLabel: string;
  /** Meilleur `inventory_item_id` si score suffisant et pas ambigu. */
  bestId: string | null;
  candidates: InventoryCandidate[];
};

export type FindInventoryOptions = {
  /** Libellés mémorisés (normalisé complet ou cœur) → inventory_item_id. */
  aliasMap?: Map<string, string>;
};

/**
 * Rapproche un libellé BL / facture avec les articles stock du restaurant.
 * Plus permissif que l’égalité stricte : tokens, Jaccard, sous-chaînes, fuzzy + ordre des mots.
 */
export function findInventoryMatchCandidates(
  rawLabel: string,
  items: { id: string; name: string }[],
  options?: FindInventoryOptions
): InventoryMatchResult {
  const normalizedLabel = normalizeInventoryItemName(rawLabel);
  const empty: InventoryMatchResult = {
    normalizedLabel,
    bestId: null,
    candidates: [],
  };

  if (!normalizedLabel || normalizedLabel.length < 2) {
    return empty;
  }

  const scored: InventoryCandidate[] = [];

  for (const it of items) {
    const stockNorm = normalizeInventoryItemName(it.name);
    if (!stockNorm) continue;

    const { score, reason } = scoreLabelAgainstStock(normalizedLabel, stockNorm);
    if (score > 0) {
      scored.push({ id: it.id, name: it.name, score, reason });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  let top = scored.slice(0, 16);

  let bestId: string | null = null;
  if (best && best.score >= INVENTORY_BL_AUTO_LINK_MIN) {
    const isExact = best.score >= SCORE_EXACT;
    const gapOk = !second || best.score - second.score >= AMBIGUITY_GAP;
    if (isExact || gapOk) {
      bestId = best.id;
    }
  }

  if (options?.aliasMap?.size) {
    const memId =
      options.aliasMap.get(normalizedLabel) ?? options.aliasMap.get(computeDeliveryLabelCore(rawLabel));
    if (memId && items.some((i) => i.id === memId)) {
      const item = items.find((i) => i.id === memId)!;
      const mem: InventoryCandidate = {
        id: memId,
        name: item.name,
        score: SCORE_EXACT,
        reason: "memorized",
      };
      top = [mem, ...top.filter((c) => c.id !== memId)].slice(0, 16);
      bestId = memId;
    }
  }

  return {
    normalizedLabel,
    bestId,
    candidates: top,
  };
}

/** Compat : retourne un id si alias mémorisé ou score suffisant. */
export function matchInventoryItemForLabel(
  label: string,
  items: { id: string; name: string }[],
  options?: FindInventoryOptions
): string | null {
  return findInventoryMatchCandidates(label, items, options).bestId;
}
