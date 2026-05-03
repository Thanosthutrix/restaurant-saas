import type { SupplierInvoiceAnalysisLine } from "@/lib/supplier-invoice-analysis";

/** Tolérance arrondis (€). */
const AMOUNT_TOLERANCE = 0.05;

/**
 * Convention métier : le restaurateur travaille en HT ; le rapprochement automatique
 * compare la somme des lignes extraites au montant HT de la facture.
 * Le TTC en pied de facture est contrôlé séparément (cohérence TTC ≥ HT), jamais en le
 * comparant à la somme des lignes (souvent HT).
 */

export type ReceptionLineRef = {
  label: string | null;
  itemName: string | null;
};

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Correspondance grossière pour V1 (pas de ML). */
export function labelsRoughlyMatch(extractedLabel: string, receptionLabel: string | null, itemName: string | null): boolean {
  const a = normalizeLabel(extractedLabel);
  if (a.length < 3) return false;
  const candidates = [receptionLabel, itemName].filter(Boolean).map((x) => normalizeLabel(x as string));
  for (const b of candidates) {
    if (b.length < 2) continue;
    if (a.includes(b) || b.includes(a)) return true;
    const aw = a.split(" ").filter((w) => w.length >= 3);
    const bw = b.split(" ").filter((w) => w.length >= 3);
    for (const w of aw) {
      if (bw.some((x) => x === w || x.includes(w) || w.includes(x))) return true;
    }
  }
  return false;
}

/**
 * Score de similarité pour choisir la meilleure ligne BL parmi plusieurs candidats
 * (évite d’apparier la facture ligne 2 avec le mauvais BL quand plusieurs libellés se ressemblent).
 * Retourne -1 si aucune correspondance grossière.
 */
export function labelMatchStrength(
  extractedLabel: string,
  receptionLabel: string | null,
  itemName: string | null
): number {
  if (!labelsRoughlyMatch(extractedLabel, receptionLabel, itemName)) return -1;
  const a = normalizeLabel(extractedLabel);
  if (a.length < 2) return 1;
  let best = 1;
  for (const cand of [receptionLabel, itemName].filter(Boolean) as string[]) {
    const b = normalizeLabel(cand);
    if (b.length < 2) continue;
    let s = 0;
    if (a === b) s += 80;
    else if (a.includes(b) || b.includes(a)) s += 25;
    const aw = new Set(a.split(" ").filter((w) => w.length >= 2));
    for (const w of b.split(" ").filter((x) => x.length >= 2)) {
      if (aw.has(w)) s += 5;
      else if ([...aw].some((x) => x.includes(w) || w.includes(x))) s += 2;
    }
    best = Math.max(best, s);
  }
  return best;
}

export type InvoiceReconciliationSummary = {
  extracted_lines_count: number;
  reception_lines_count: number;
  /** Somme des totaux ligne extraits (traités comme montants HT pour le rapprochement). */
  sum_extracted_line_totals: number | null;
  /** Nombre de lignes facture ayant au moins une ligne réception « proche » au niveau libellé. */
  fuzzy_matched_extracted_count: number;
  amount_ttc_on_invoice: number | null;
  amount_ht_on_invoice: number | null;
  /** Somme lignes (HT) − total HT facture (rapprochement principal). */
  delta_ht_vs_sum_lines: number | null;
  /** Total TTC facture − total HT facture (pied de facture uniquement), si les deux sont saisis. */
  ttc_minus_ht_invoice: number | null;
  hints: string[];
};

export type InvoiceReceptionLineForComparison = {
  deliveryNoteId: string | null;
  deliveryNoteLineId: string | null;
  label: string | null;
  itemName: string | null;
  purchaseUnit: string | null;
  stockUnit: string | null;
  qtyDeliveredPurchase: number | null;
  qtyReceivedStock: number | null;
  purchaseToStockRatio: number | null;
  blLineTotalHt: number | null;
  blUnitPriceStockHt: number | null;
  manualUnitPriceStockHt: number | null;
};

export type InvoiceLineComparison = {
  status: "ok" | "price_delta" | "qty_delta" | "invoice_only" | "reception_only";
  invoiceLineIndex: number | null;
  invoiceLabel: string | null;
  invoiceUnit: string | null;
  invoiceQuantity: number | null;
  invoiceUnitPrice: number | null;
  invoiceLineTotal: number | null;
  receptionLabel: string | null;
  receptionItemName: string | null;
  receptionDeliveryNoteId: string | null;
  receptionLineId: string | null;
  receptionPurchaseUnit: string | null;
  receptionStockUnit: string | null;
  receptionQuantityPurchase: number | null;
  receptionUnitPricePurchase: number | null;
  receptionPriceSource: "bl" | "invoice_fallback" | "missing";
  receptionLineTotal: number | null;
  qtyDelta: number | null;
  /** PU facture − PU BL (uniquement si le BL fournit un PU ; sinon null). */
  unitPriceDelta: number | null;
  /** Total HT ligne facture − total HT ligne côté BL (référence la plus fiable pour l’écart « argent »). */
  lineTotalDelta: number | null;
  /** Conservé pour compatibilité ; le détail est dans `describeBlVsInvoiceLineIssues`. */
  hints: string[];
};

/**
 * Résumé lisible (contrôle BL vs facture) : quelles lignes posent problème et pourquoi.
 */
export function describeBlVsInvoiceLineIssues(rows: InvoiceLineComparison[]): string[] {
  const out: string[] = [];

  for (const row of rows) {
    const invLabel = row.invoiceLabel?.trim();
    const blLabel = row.receptionItemName?.trim() || row.receptionLabel?.trim();

    if (row.status === "invoice_only") {
      out.push(
        `Facture — « ${invLabel || "ligne"} » : aucun BL lié ne correspond à ce libellé (recherche automatique). Vérifiez réceptions liées, liaison produit et libellés.`
      );
      continue;
    }

    if (row.status === "reception_only") {
      out.push(
        `BL — « ${blLabel || "ligne"} » : réception valorisée mais aucune ligne facture assortie. Article absent de la lecture ou libellé trop différent.`
      );
      continue;
    }

    const parts: string[] = [];
    if (row.qtyDelta != null && Math.abs(row.qtyDelta) > 0.0001) {
      parts.push(
        `quantités ${row.invoiceQuantity ?? "—"} ${row.invoiceUnit ?? ""} (facture) vs ${row.receptionQuantityPurchase ?? "—"} ${row.receptionPurchaseUnit ?? ""} (BL)`
      );
    }
    if (row.unitPriceDelta != null && Math.abs(row.unitPriceDelta) > AMOUNT_TOLERANCE) {
      parts.push(`PU HT écart ${row.unitPriceDelta > 0 ? "+" : ""}${row.unitPriceDelta.toLocaleString("fr-FR")} €`);
    }
    if (row.lineTotalDelta != null && Math.abs(row.lineTotalDelta) > AMOUNT_TOLERANCE) {
      parts.push(
        `total ligne HT écart ${row.lineTotalDelta > 0 ? "+" : ""}${row.lineTotalDelta.toLocaleString("fr-FR")} €`
      );
    }
    if (
      row.invoiceUnit &&
      row.receptionPurchaseUnit &&
      normalizeLabel(row.invoiceUnit) !== normalizeLabel(row.receptionPurchaseUnit)
    ) {
      parts.push(`unités différentes (${row.invoiceUnit} vs ${row.receptionPurchaseUnit})`);
    }
    if (row.receptionPriceSource === "missing") {
      parts.push("prix / total BL insuffisants pour comparer");
    }

    if (parts.length === 0) continue;

    const title = invLabel ? `« ${invLabel} »` : `« ${blLabel || "ligne"} »`;
    const against = blLabel && invLabel !== blLabel ? ` avec BL « ${blLabel} »` : "";
    out.push(`${title}${against} : ${parts.join(" ; ")}.`);
  }

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function unitPricePurchaseFromReceptionLine(line: InvoiceReceptionLineForComparison): number | null {
  const total = line.blLineTotalHt;
  const qtyPurchase = line.qtyDeliveredPurchase;
  if (total != null && Number.isFinite(total) && total > 0 && qtyPurchase != null && qtyPurchase > 0) {
    return round2(total / qtyPurchase);
  }

  const stockUnit =
    line.manualUnitPriceStockHt != null && Number.isFinite(line.manualUnitPriceStockHt) && line.manualUnitPriceStockHt > 0
      ? line.manualUnitPriceStockHt
      : line.blUnitPriceStockHt != null && Number.isFinite(line.blUnitPriceStockHt) && line.blUnitPriceStockHt > 0
        ? line.blUnitPriceStockHt
        : null;
  const ratio = line.purchaseToStockRatio;
  if (stockUnit != null && ratio != null && Number.isFinite(ratio) && ratio > 0) {
    return round2(stockUnit * ratio);
  }
  return null;
}

function lineTotalFromUnit(qty: number | null, unitPrice: number | null, explicitTotal?: number | null): number | null {
  if (explicitTotal != null && Number.isFinite(explicitTotal) && explicitTotal > 0) return round2(explicitTotal);
  if (qty != null && unitPrice != null && Number.isFinite(qty) && Number.isFinite(unitPrice)) return round2(qty * unitPrice);
  return null;
}

export function buildInvoiceLineComparisons(input: {
  extractedLines: SupplierInvoiceAnalysisLine[];
  receptionLines: InvoiceReceptionLineForComparison[];
}): InvoiceLineComparison[] {
  const out: InvoiceLineComparison[] = [];
  const usedReceptionIndexes = new Set<number>();

  for (let invIndex = 0; invIndex < input.extractedLines.length; invIndex++) {
    const inv = input.extractedLines[invIndex];
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < input.receptionLines.length; i++) {
      if (usedReceptionIndexes.has(i)) continue;
      const rec = input.receptionLines[i];
      const score = labelMatchStrength(inv.label, rec.label, rec.itemName);
      if (score < 0) continue;
      if (score > bestScore || (score === bestScore && (bestIdx < 0 || i < bestIdx))) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) {
      out.push({
        status: "invoice_only",
        invoiceLineIndex: invIndex,
        invoiceLabel: inv.label,
        invoiceUnit: inv.unit,
        invoiceQuantity: inv.quantity,
        invoiceUnitPrice: inv.unit_price,
        invoiceLineTotal: inv.line_total,
        receptionLabel: null,
        receptionItemName: null,
        receptionDeliveryNoteId: null,
        receptionLineId: null,
        receptionPurchaseUnit: null,
        receptionStockUnit: null,
        receptionQuantityPurchase: null,
        receptionUnitPricePurchase: null,
        receptionPriceSource: "missing",
        receptionLineTotal: null,
        qtyDelta: null,
        unitPriceDelta: null,
        lineTotalDelta: null,
        hints: [],
      });
      continue;
    }

    usedReceptionIndexes.add(bestIdx);
    const rec = input.receptionLines[bestIdx];
    const recUnitFromBl = unitPricePurchaseFromReceptionLine(rec);
    const recUnit =
      recUnitFromBl ??
      (inv.unit_price != null && Number.isFinite(inv.unit_price) && inv.unit_price > 0 ? inv.unit_price : null);
    const recPriceSource = recUnitFromBl != null ? "bl" : recUnit != null ? "invoice_fallback" : "missing";
    const invTotal = lineTotalFromUnit(inv.quantity, inv.unit_price, inv.line_total);
    const recTotal = lineTotalFromUnit(rec.qtyDeliveredPurchase, recUnit, rec.blLineTotalHt);
    const qtyDelta =
      inv.quantity != null && rec.qtyDeliveredPurchase != null ? round2(inv.quantity - rec.qtyDeliveredPurchase) : null;
    /** Écart PU facture − PU réellement issu du BL uniquement (pas de repli facture, sinon l’écart serait toujours 0). */
    const unitPriceDelta =
      inv.unit_price != null && recUnitFromBl != null ? round2(inv.unit_price - recUnitFromBl) : null;
    const lineTotalDelta = invTotal != null && recTotal != null ? round2(invTotal - recTotal) : null;
    let status: InvoiceLineComparison["status"] = "ok";

    const hasQtyIssue = qtyDelta != null && Math.abs(qtyDelta) > 0.0001;
    const hasPriceIssue = unitPriceDelta != null && Math.abs(unitPriceDelta) > AMOUNT_TOLERANCE;
    const hasTotalIssue = lineTotalDelta != null && Math.abs(lineTotalDelta) > AMOUNT_TOLERANCE;

    if (hasQtyIssue) {
      status = "qty_delta";
    }
    if (hasPriceIssue) {
      status = status === "qty_delta" ? "qty_delta" : "price_delta";
    }
    if (hasTotalIssue && status === "ok") {
      status = "price_delta";
    }

    out.push({
      status,
      invoiceLineIndex: invIndex,
      invoiceLabel: inv.label,
      invoiceUnit: inv.unit,
      invoiceQuantity: inv.quantity,
      invoiceUnitPrice: inv.unit_price,
      invoiceLineTotal: invTotal,
      receptionLabel: rec.label,
      receptionItemName: rec.itemName,
      receptionDeliveryNoteId: rec.deliveryNoteId,
      receptionLineId: rec.deliveryNoteLineId,
      receptionPurchaseUnit: rec.purchaseUnit,
      receptionStockUnit: rec.stockUnit,
      receptionQuantityPurchase: rec.qtyDeliveredPurchase,
      receptionUnitPricePurchase: recUnit,
      receptionPriceSource: recPriceSource,
      receptionLineTotal: recTotal,
      qtyDelta,
      unitPriceDelta,
      lineTotalDelta,
      hints: [],
    });
  }

  input.receptionLines.forEach((rec, i) => {
    if (usedReceptionIndexes.has(i)) return;
    const recUnitBl = unitPricePurchaseFromReceptionLine(rec);
    const recTotalOnly = lineTotalFromUnit(rec.qtyDeliveredPurchase, recUnitBl, rec.blLineTotalHt);
    out.push({
      status: "reception_only",
      invoiceLineIndex: null,
      invoiceLabel: null,
      invoiceUnit: null,
      invoiceQuantity: null,
      invoiceUnitPrice: null,
      invoiceLineTotal: null,
      receptionLabel: rec.label,
      receptionItemName: rec.itemName,
      receptionDeliveryNoteId: rec.deliveryNoteId,
      receptionLineId: rec.deliveryNoteLineId,
      receptionPurchaseUnit: rec.purchaseUnit,
      receptionStockUnit: rec.stockUnit,
      receptionQuantityPurchase: rec.qtyDeliveredPurchase,
      receptionUnitPricePurchase: recUnitBl,
      receptionPriceSource: recUnitBl != null ? "bl" : "missing",
      receptionLineTotal: recTotalOnly,
      qtyDelta: null,
      unitPriceDelta: null,
      lineTotalDelta: null,
      hints: [],
    });
  });

  return out;
}

export function buildInvoiceReconciliation(input: {
  extractedLines: SupplierInvoiceAnalysisLine[];
  receptionLines: ReceptionLineRef[];
  amount_ht: number | null;
  amount_ttc: number | null;
}): InvoiceReconciliationSummary {
  const hints: string[] = [];
  const extracted_lines_count = input.extractedLines.length;
  const reception_lines_count = input.receptionLines.length;

  let sum = 0;
  let hasAnyTotal = false;
  for (const line of input.extractedLines) {
    if (line.line_total != null && Number.isFinite(line.line_total)) {
      sum += line.line_total;
      hasAnyTotal = true;
    }
  }
  const sum_extracted_line_totals = hasAnyTotal ? Math.round(sum * 100) / 100 : null;

  let fuzzy_matched_extracted_count = 0;
  for (const el of input.extractedLines) {
    const ok = input.receptionLines.some((r) => labelsRoughlyMatch(el.label, r.label, r.itemName));
    if (ok) fuzzy_matched_extracted_count += 1;
  }

  const amount_ttc_on_invoice = input.amount_ttc;
  const amount_ht_on_invoice = input.amount_ht;

  let ttc_minus_ht_invoice: number | null = null;
  if (input.amount_ht != null && input.amount_ttc != null) {
    ttc_minus_ht_invoice = Math.round((input.amount_ttc - input.amount_ht) * 100) / 100;
    if (input.amount_ttc + AMOUNT_TOLERANCE < input.amount_ht) {
      hints.push(
        `Incohérence des totaux : le montant TTC saisi (${input.amount_ttc.toLocaleString("fr-FR")} €) est inférieur au montant HT (${input.amount_ht.toLocaleString("fr-FR")} €). Vérifiez le pied de facture.`
      );
    }
  }

  let delta_ht_vs_sum_lines: number | null = null;
  if (sum_extracted_line_totals != null && input.amount_ht != null) {
    delta_ht_vs_sum_lines = Math.round((sum_extracted_line_totals - input.amount_ht) * 100) / 100;
    if (Math.abs(delta_ht_vs_sum_lines) > AMOUNT_TOLERANCE) {
      hints.push(
        `Rapprochement HT : la somme des totaux ligne extraits (${sum_extracted_line_totals.toLocaleString("fr-FR")} €) ne correspond pas au montant HT de la facture (${input.amount_ht.toLocaleString("fr-FR")} €). Écart : ${delta_ht_vs_sum_lines > 0 ? "+" : ""}${delta_ht_vs_sum_lines.toLocaleString("fr-FR")} €.`
      );
    }
  }

  if (sum_extracted_line_totals != null && input.amount_ht == null && input.amount_ttc != null) {
    hints.push(
      "Les rapprochements de montants se font en hors taxes : renseignez le montant HT de la facture pour comparer avec la somme des lignes extraites (également attendues en HT). Le TTC reste utile en pied de facture."
    );
  }

  if (sum_extracted_line_totals != null && input.amount_ht == null && input.amount_ttc == null) {
    hints.push(
      "Renseignez au minimum le montant HT (et le TTC en pied de facture si besoin) pour activer les contrôles sur les totaux."
    );
  }

  if (extracted_lines_count > 0 && reception_lines_count > 0 && extracted_lines_count !== reception_lines_count) {
    hints.push(
      `Nombre de lignes : ${extracted_lines_count} sur la facture (extrait) vs ${reception_lines_count} sur les réceptions liées.`
    );
  }

  if (extracted_lines_count > 0 && reception_lines_count > 0) {
    const unmatched = extracted_lines_count - fuzzy_matched_extracted_count;
    if (unmatched > 0) {
      hints.push(
        `${unmatched} ligne(s) de facture n’ont pas de libellé clairement rapprochable avec les réceptions (sur ${extracted_lines_count}). Contrôle manuel recommandé.`
      );
    } else {
      hints.push(
        `Chaque ligne extraite a au moins une correspondance de libellé approximative avec une réception (à confirmer).`
      );
    }
  }

  if (extracted_lines_count > 0 && reception_lines_count === 0) {
    hints.push("Aucune réception liée : impossible de rapprocher les lignes avec des bons de livraison.");
  }

  return {
    extracted_lines_count,
    reception_lines_count,
    sum_extracted_line_totals,
    fuzzy_matched_extracted_count,
    amount_ttc_on_invoice,
    amount_ht_on_invoice,
    delta_ht_vs_sum_lines,
    ttc_minus_ht_invoice,
    hints,
  };
}
