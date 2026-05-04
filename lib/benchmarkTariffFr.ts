import "server-only";

import type { AllowedUnit } from "@/lib/constants";
import { roundMoney, roundReferenceUnitCostHt } from "@/lib/stock/purchasePriceHistory";

import raw from "@/data/base_tarifs_restaurants_france_500_produits.json";

export type BenchmarkProductFr = {
  id: string;
  famille: string;
  sous_famille: string;
  produit: string;
  type: string;
  unite_achat?: string;
  /** Litres ou kg par unité de vente (ex. 0,33 L pour une canette). */
  qte_contenant?: number;
  unite_normalisee: string;
  prix_normalise_ht: number;
  prix_moyen_ht: number;
};

function asProduits(): BenchmarkProductFr[] {
  const o = raw as { produits?: unknown };
  if (!Array.isArray(o.produits)) return [];
  return o.produits as BenchmarkProductFr[];
}

function parsePositiveEuro(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const n = Number(value.trim().replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Prix HT issu du fichier : **moyenne en priorité** (comme dans la base fournie), sinon prix normalisé.
 * € / kg, € / L, etc. selon `unite_normalisee`.
 */
export function euroPriceFromCatalogRow(
  row: Pick<BenchmarkProductFr, "prix_moyen_ht" | "prix_normalise_ht">
): number | null {
  const moyen = parsePositiveEuro(row.prix_moyen_ht);
  const norm = parsePositiveEuro(row.prix_normalise_ht);
  return moyen ?? norm ?? null;
}

function catalogUnitLabelForDisplay(uniteNormalisee: string): string {
  const u = String(uniteNormalisee ?? "").trim().toLowerCase();
  if (u === "l") return "L";
  if (u === "kg") return "kg";
  if (u === "unit" || u === "unite" || u === "unité") return "unité";
  return u || "—";
}

/** Normalise pour comparaison de libellés (insensible à la casse / accents). */
export function normalizeFrLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[''`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function catalogTypesForItemType(itemType: "ingredient" | "prep" | "resale"): Set<string> {
  if (itemType === "prep") return new Set();
  /** Boissons (softs, eaux…) : même recherche que pour la revente — souvent saisies en « matière ». */
  if (itemType === "resale") return new Set(["Ingrédient", "Boisson"]);
  return new Set(["Ingrédient", "Boisson"]);
}

/**
 * Convertit le prix HT du fichier vers € / unité de stock app.
 * - kg/L : conversions g, kg, ml, l.
 * - unité / sceau : si la base donne un prix au L ou au kg et une quantité par contenant (ex. 0,33 L), €/L × L = € par canette.
 */
export function benchmarkPriceForStockUnit(
  row: Pick<
    BenchmarkProductFr,
    "unite_normalisee" | "prix_normalise_ht" | "prix_moyen_ht" | "qte_contenant"
  >,
  stockUnit: AllowedUnit
): number | null {
  const norm = String(row.unite_normalisee ?? "")
    .trim()
    .toLowerCase();
  const prix = euroPriceFromCatalogRow(row);
  if (prix == null) return null;

  const qCont = row.qte_contenant != null ? Number(row.qte_contenant) : NaN;
  const hasQty = Number.isFinite(qCont) && qCont > 0 && qCont <= 500;

  if (stockUnit === "unit" || stockUnit === "sceau") {
    if (norm === "l" && hasQty) return prix * qCont;
    if (norm === "kg" && hasQty) return prix * qCont;
    return null;
  }

  if (norm === "kg") {
    if (stockUnit === "kg") return prix;
    if (stockUnit === "g") return prix / 1000;
    return null;
  }
  if (norm === "l") {
    if (stockUnit === "l") return prix;
    if (stockUnit === "ml") return prix / 1000;
    return null;
  }
  return null;
}

function matchScore(nameNorm: string, produitNorm: string): number {
  if (nameNorm.length === 0 || produitNorm.length === 0) return 0;
  if (nameNorm === produitNorm) return 100_000 + produitNorm.length;
  if (produitNorm.startsWith(`${nameNorm} `) || produitNorm.startsWith(`${nameNorm},`)) {
    return 50_000 + produitNorm.length;
  }
  if (nameNorm.startsWith(`${produitNorm} `) || nameNorm.startsWith(`${produitNorm},`)) {
    return 40_000 + produitNorm.length;
  }
  if (nameNorm.length >= 2 && produitNorm.includes(nameNorm)) {
    const idx = produitNorm.indexOf(nameNorm);
    const beforeCh = idx > 0 ? produitNorm[idx - 1]! : " ";
    const afterCh = produitNorm[idx + nameNorm.length] ?? " ";
    const boundaryBefore = !/[a-z0-9]/.test(beforeCh);
    const boundaryAfter = !/[a-z0-9]/.test(afterCh);
    if (boundaryBefore && boundaryAfter) return 35_000 + produitNorm.length;
  }
  return 0;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}

/** Score 0–1 : libellés proches (Levenshtein, mots communs, sous-chaîne). */
export function benchmarkLabelSimilarity(nameNorm: string, produitNorm: string): number {
  if (!nameNorm || !produitNorm) return 0;
  if (matchScore(nameNorm, produitNorm) > 0) return 1;

  const maxLen = Math.max(nameNorm.length, produitNorm.length, 1);
  const lev = levenshtein(nameNorm, produitNorm);
  let score = 1 - lev / maxLen;

  if (nameNorm.length >= 2 && produitNorm.includes(nameNorm)) score = Math.max(score, 0.9);
  if (produitNorm.length >= 2 && nameNorm.includes(produitNorm)) score = Math.max(score, 0.85);

  const firstTok = produitNorm.split(/[\s-]+/).find((t) => t.length > 0) ?? "";
  if (nameNorm.length >= 2 && firstTok.length > 0) {
    if (firstTok === nameNorm || firstTok.startsWith(`${nameNorm}-`) || firstTok.startsWith(nameNorm)) {
      score = Math.max(score, 0.92);
    }
  }

  const wordsA = nameNorm.split(" ").filter((w) => w.length > 1);
  const wordsB = produitNorm.split(" ").filter((w) => w.length > 1);
  if (wordsA.length && wordsB.length) {
    let hit = 0;
    for (const wa of wordsA) {
      if (wordsB.some((wb) => wb === wa || wb.includes(wa) || wa.includes(wb))) hit++;
    }
    score = Math.max(score, (hit / Math.max(wordsA.length, 1)) * 0.8);
  }

  const lim = Math.min(nameNorm.length, produitNorm.length, 10);
  if (lim >= 2) {
    let prefix = 0;
    for (let i = 0; i < lim; i++) {
      if (nameNorm[i] === produitNorm[i]) prefix++;
    }
    score = Math.max(score, (prefix / lim) * 0.45);
  }

  return Math.min(1, Math.max(0, score));
}

export type BenchmarkSuggestion = {
  productId: string;
  produitLabel: string;
  famille: string;
  /** € HT / unité de stock app (ex. €/g si le stock est en g — valeurs petites mais correctes). */
  price: number;
  /** Score interne (tri décroissant). */
  score: number;
  /** Moyenne HT du fichier (€ / kg, € / L…), pour affichage lisible. */
  catalogMeanEuroHt: number;
  /** Libellé court pour l’affichage (kg, L…). */
  catalogNormalizedUnit: string;
};

/**
 * Propositions les plus proches du nom (tri par similarité de libellé ; prix selon l’unité de stock).
 */
export function listBenchmarkTariffSuggestions(
  name: string,
  itemType: "ingredient" | "prep" | "resale",
  stockUnit: AllowedUnit,
  options?: { limit?: number; minScore?: number }
): BenchmarkSuggestion[] {
  if (itemType === "prep") return [];
  const limit = options?.limit ?? 12;
  const minScore = options?.minScore ?? 0.08;
  const allowedTypes = catalogTypesForItemType(itemType);
  const nameNorm = normalizeFrLabel(name);
  if (!nameNorm) return [];

  const scored: BenchmarkSuggestion[] = [];
  for (const row of asProduits()) {
    if (!allowedTypes.has(row.type)) continue;
    const meanEuro = euroPriceFromCatalogRow(row);
    const priceRaw = benchmarkPriceForStockUnit(row, stockUnit);
    if (meanEuro == null || priceRaw == null || !Number.isFinite(priceRaw) || priceRaw <= 0) continue;
    const produitNorm = normalizeFrLabel(row.produit);
    const score = benchmarkLabelSimilarity(nameNorm, produitNorm);
    if (score < minScore) continue;
    scored.push({
      productId: row.id,
      produitLabel: row.produit,
      famille: row.famille,
      price: roundReferenceUnitCostHt(priceRaw),
      score,
      catalogMeanEuroHt: roundMoney(meanEuro),
      catalogNormalizedUnit: catalogUnitLabelForDisplay(String(row.unite_normalisee ?? "")),
    });
  }
  scored.sort((a, b) => b.score - a.score || b.produitLabel.length - a.produitLabel.length);
  return scored.slice(0, limit);
}

export function getBenchmarkProductById(productId: string): BenchmarkProductFr | null {
  const id = productId.trim();
  if (!id) return null;
  return asProduits().find((p) => p.id === id) ?? null;
}

export type BenchmarkMatchResult = {
  /** € HT / unité de stock (précision renforcée pour g / ml). */
  price: number;
  productId: string;
  produitLabel: string;
};

/**
 * Trouve une ligne du référentiel : d’abord règles strictes (égalité / préfixe), sinon meilleure similarité de nom.
 */
export function findBenchmarkTariffMatch(
  name: string,
  itemType: "ingredient" | "prep" | "resale",
  stockUnit: AllowedUnit
): BenchmarkMatchResult | null {
  if (itemType === "prep") return null;
  const allowedTypes = catalogTypesForItemType(itemType);
  const nameNorm = normalizeFrLabel(name);
  if (!nameNorm) return null;

  let best: { row: BenchmarkProductFr; score: number; price: number } | null = null;
  for (const row of asProduits()) {
    if (!allowedTypes.has(row.type)) continue;
    const produitNorm = normalizeFrLabel(row.produit);
    const score = matchScore(nameNorm, produitNorm);
    if (score <= 0) continue;
    const priceRaw = benchmarkPriceForStockUnit(row, stockUnit);
    if (priceRaw == null || !Number.isFinite(priceRaw) || priceRaw <= 0) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && row.produit.length > best.row.produit.length)
    ) {
      best = { row, score, price: priceRaw };
    }
  }
  if (best) {
    return {
      price: roundReferenceUnitCostHt(best.price),
      productId: best.row.id,
      produitLabel: best.row.produit,
    };
  }

  const FUZZY_MIN = 0.36;
  let bestFuzzy: { row: BenchmarkProductFr; sim: number; price: number } | null = null;
  for (const row of asProduits()) {
    if (!allowedTypes.has(row.type)) continue;
    const priceRaw = benchmarkPriceForStockUnit(row, stockUnit);
    if (priceRaw == null || !Number.isFinite(priceRaw) || priceRaw <= 0) continue;
    const produitNorm = normalizeFrLabel(row.produit);
    const sim = benchmarkLabelSimilarity(nameNorm, produitNorm);
    if (sim < FUZZY_MIN) continue;
    if (
      !bestFuzzy ||
      sim > bestFuzzy.sim + 1e-9 ||
      (Math.abs(sim - bestFuzzy.sim) < 1e-9 && row.produit.length > bestFuzzy.row.produit.length)
    ) {
      bestFuzzy = { row, sim, price: priceRaw };
    }
  }
  if (!bestFuzzy) return null;
  return {
    price: roundReferenceUnitCostHt(bestFuzzy.price),
    productId: bestFuzzy.row.id,
    produitLabel: bestFuzzy.row.produit,
  };
}
