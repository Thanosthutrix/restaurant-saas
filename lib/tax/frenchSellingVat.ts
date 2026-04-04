/**
 * TVA française sur prix de vente carte (restauration / boissons).
 * HT = TTC / (1 + taux/100).
 */

export type FrenchSellingVatPreset = { ratePct: number; label: string; hint: string };

/** Taux courants affichés à la saisie (d’autres valeurs restent possibles côté API si besoin). */
export const FRENCH_SELLING_VAT_PRESETS: FrenchSellingVatPreset[] = [
  {
    ratePct: 5.5,
    label: "5,5 %",
    hint: "Taux réduit (certains produits alimentaires à emporter, etc.)",
  },
  {
    ratePct: 10,
    label: "10 %",
    hint: "Restauration sur place, livraison de repas (cadre général)",
  },
  {
    ratePct: 20,
    label: "20 %",
    hint: "Alcool, produits soumis au taux normal",
  },
];

export function roundSellingMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Prix HT (€) à partir du TTC et du taux de TVA en %. */
export function sellingPriceHtFromTtc(ttc: number, vatRatePct: number): number {
  if (!Number.isFinite(ttc) || ttc < 0) return 0;
  const v = Number(vatRatePct);
  if (!Number.isFinite(v) || v < 0) return roundSellingMoney(ttc);
  const denom = 1 + v / 100;
  if (denom <= 0) return roundSellingMoney(ttc);
  return roundSellingMoney(ttc / denom);
}

/** TTC (€) à partir du HT et du taux (ex. migration ou simulation). */
export function sellingPriceTtcFromHt(ht: number, vatRatePct: number): number {
  if (!Number.isFinite(ht) || ht < 0) return 0;
  const v = Number(vatRatePct);
  if (!Number.isFinite(v) || v < 0) return roundSellingMoney(ht);
  return roundSellingMoney(ht * (1 + v / 100));
}

export function normalizeVatRatePct(raw: unknown, fallback = 10): number {
  if (raw == null || raw === "") return fallback;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n;
}
