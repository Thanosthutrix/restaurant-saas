import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { computeDeliveryLabelCore } from "@/lib/matching/deliveryLabelCore";

export type BlConversionInventoryHint = {
  id: string;
  unit: string | null;
  units_per_purchase: number | null;
};

export type SavedBlConversionHint = {
  stockUnitsPerPurchase: number;
  blPurchaseUnit: string | null;
};

function normalizeStockUnit(u: string | null | undefined): string {
  if (!u) return "";
  const s = u.trim().toLowerCase();
  if (/^(g|gr|gramme|grammes)$/.test(s)) return "g";
  if (/^(kg|kilogramme|kilos?)$/.test(s)) return "kg";
  if (/^(l|litre|litres)$/.test(s)) return "l";
  if (/^(ml|millilitre|millilitres)$/.test(s)) return "ml";
  return s;
}

/**
 * Infère combien d’unités de stock correspondent à 1 unité livrée BL quand le libellé ou l’unité
 * mentionne un conditionnement (ex. « sac 20 kg » avec stock en g → 20000).
 */
export function inferStockUnitsPerPurchaseFromBlText(
  stockUnit: string | null,
  blUnit: string | null,
  lineLabel: string,
  packagingHint: string | null
): number | null {
  const su = normalizeStockUnit(stockUnit);
  const haystack = `${blUnit ?? ""} ${packagingHint ?? ""} ${lineLabel}`.toLowerCase();

  const kgMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  if (kgMatch && su === "g") {
    const kg = parseFloat(kgMatch[1].replace(",", "."));
    if (Number.isFinite(kg) && kg > 0) return kg * 1000;
  }

  const gMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (gMatch && su === "g") {
    const g = parseFloat(gMatch[1].replace(",", "."));
    if (Number.isFinite(g) && g > 0 && (!kgMatch || g < 1000)) return g;
  }

  const lMatch = haystack.match(/(\d+(?:[.,]\d+)?)\s*(?:l|litres?)\b/i);
  if (lMatch && su === "ml") {
    const liters = parseFloat(lMatch[1].replace(",", "."));
    if (Number.isFinite(liters) && liters > 0) return liters * 1000;
  }

  return null;
}

export function effectiveStockUnitsPerPurchase(
  item: BlConversionInventoryHint | null,
  savedHint: SavedBlConversionHint | undefined,
  blUnit: string | null,
  lineLabel: string,
  packagingHint: string | null
): number {
  const fromItem = item?.units_per_purchase;
  if (fromItem != null && Number.isFinite(Number(fromItem)) && Number(fromItem) > 0) {
    return Number(fromItem);
  }
  if (
    savedHint?.stockUnitsPerPurchase != null &&
    Number.isFinite(savedHint.stockUnitsPerPurchase) &&
    savedHint.stockUnitsPerPurchase > 0
  ) {
    return savedHint.stockUnitsPerPurchase;
  }
  const inferred = inferStockUnitsPerPurchaseFromBlText(
    item?.unit ?? null,
    blUnit,
    lineLabel,
    packagingHint
  );
  if (inferred != null && inferred > 0) return inferred;
  return 1;
}

export function qtyReceivedFromBlDelivery(
  qtyDelivered: number,
  item: BlConversionInventoryHint | null,
  savedHint: SavedBlConversionHint | undefined,
  blUnit: string | null,
  lineLabel: string,
  packagingHint: string | null
): number {
  const ratio = effectiveStockUnitsPerPurchase(item, savedHint, blUnit, lineLabel, packagingHint);
  return Math.round(qtyDelivered * ratio * 1000) / 1000;
}

/** Repère une ligne sauvegardée (clés = libellé normalisé et label_core). */
export function lookupSavedBlConversion(
  rawLabel: string,
  hintMap: Map<string, SavedBlConversionHint>
): SavedBlConversionHint | undefined {
  const normalized = normalizeInventoryItemName(rawLabel);
  const core = computeDeliveryLabelCore(rawLabel);
  return hintMap.get(normalized) ?? hintMap.get(core);
}

export function computeDeliveryLineQtyReceived(params: {
  qtyDelivered: number;
  inventoryItemId: string | null;
  label: string;
  unit: string | null;
  packagingHint: string | null;
  invById: Map<string, BlConversionInventoryHint>;
  hintMap: Map<string, SavedBlConversionHint>;
}): number {
  const inv = params.inventoryItemId
    ? params.invById.get(params.inventoryItemId) ?? null
    : null;
  const hint = lookupSavedBlConversion(params.label, params.hintMap);
  return qtyReceivedFromBlDelivery(
    params.qtyDelivered,
    inv,
    hint,
    params.unit,
    params.label,
    params.packagingHint
  );
}
