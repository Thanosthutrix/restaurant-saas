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
  label: string | null;
  itemName: string | null;
  qtyDeliveredPurchase: number | null;
  qtyReceivedStock: number | null;
  purchaseToStockRatio: number | null;
  blLineTotalHt: number | null;
  blUnitPriceStockHt: number | null;
  manualUnitPriceStockHt: number | null;
};

export type InvoiceLineComparison = {
  status: "ok" | "price_delta" | "qty_delta" | "invoice_only" | "reception_only";
  invoiceLabel: string | null;
  invoiceQuantity: number | null;
  invoiceUnitPrice: number | null;
  invoiceLineTotal: number | null;
  receptionLabel: string | null;
  receptionItemName: string | null;
  receptionQuantityPurchase: number | null;
  receptionUnitPricePurchase: number | null;
  receptionLineTotal: number | null;
  qtyDelta: number | null;
  unitPriceDelta: number | null;
  lineTotalDelta: number | null;
  hints: string[];
};

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

  for (const inv of input.extractedLines) {
    let bestIdx = -1;
    for (let i = 0; i < input.receptionLines.length; i++) {
      if (usedReceptionIndexes.has(i)) continue;
      const rec = input.receptionLines[i];
      if (labelsRoughlyMatch(inv.label, rec.label, rec.itemName)) {
        bestIdx = i;
        break;
      }
    }

    if (bestIdx < 0) {
      out.push({
        status: "invoice_only",
        invoiceLabel: inv.label,
        invoiceQuantity: inv.quantity,
        invoiceUnitPrice: inv.unit_price,
        invoiceLineTotal: inv.line_total,
        receptionLabel: null,
        receptionItemName: null,
        receptionQuantityPurchase: null,
        receptionUnitPricePurchase: null,
        receptionLineTotal: null,
        qtyDelta: null,
        unitPriceDelta: null,
        lineTotalDelta: null,
        hints: ["Ligne présente sur la facture, non retrouvée dans les BL liés."],
      });
      continue;
    }

    usedReceptionIndexes.add(bestIdx);
    const rec = input.receptionLines[bestIdx];
    const recUnit = unitPricePurchaseFromReceptionLine(rec);
    const invTotal = lineTotalFromUnit(inv.quantity, inv.unit_price, inv.line_total);
    const recTotal = lineTotalFromUnit(rec.qtyDeliveredPurchase, recUnit, rec.blLineTotalHt);
    const qtyDelta =
      inv.quantity != null && rec.qtyDeliveredPurchase != null ? round2(inv.quantity - rec.qtyDeliveredPurchase) : null;
    const unitPriceDelta = inv.unit_price != null && recUnit != null ? round2(inv.unit_price - recUnit) : null;
    const lineTotalDelta = invTotal != null && recTotal != null ? round2(invTotal - recTotal) : null;
    const hints: string[] = [];
    let status: InvoiceLineComparison["status"] = "ok";

    if (qtyDelta != null && Math.abs(qtyDelta) > 0.0001) {
      status = "qty_delta";
      hints.push(`Écart quantité : facture ${inv.quantity} vs BL ${rec.qtyDeliveredPurchase}.`);
    }
    if (unitPriceDelta != null && Math.abs(unitPriceDelta) > AMOUNT_TOLERANCE) {
      status = status === "qty_delta" ? "qty_delta" : "price_delta";
      hints.push(`Écart prix unitaire : ${unitPriceDelta > 0 ? "+" : ""}${unitPriceDelta.toLocaleString("fr-FR")} €.`);
    }
    if (lineTotalDelta != null && Math.abs(lineTotalDelta) > AMOUNT_TOLERANCE) {
      hints.push(`Écart total ligne : ${lineTotalDelta > 0 ? "+" : ""}${lineTotalDelta.toLocaleString("fr-FR")} €.`);
      if (status === "ok") status = "price_delta";
    }

    out.push({
      status,
      invoiceLabel: inv.label,
      invoiceQuantity: inv.quantity,
      invoiceUnitPrice: inv.unit_price,
      invoiceLineTotal: invTotal,
      receptionLabel: rec.label,
      receptionItemName: rec.itemName,
      receptionQuantityPurchase: rec.qtyDeliveredPurchase,
      receptionUnitPricePurchase: recUnit,
      receptionLineTotal: recTotal,
      qtyDelta,
      unitPriceDelta,
      lineTotalDelta,
      hints,
    });
  }

  input.receptionLines.forEach((rec, i) => {
    if (usedReceptionIndexes.has(i)) return;
    out.push({
      status: "reception_only",
      invoiceLabel: null,
      invoiceQuantity: null,
      invoiceUnitPrice: null,
      invoiceLineTotal: null,
      receptionLabel: rec.label,
      receptionItemName: rec.itemName,
      receptionQuantityPurchase: rec.qtyDeliveredPurchase,
      receptionUnitPricePurchase: unitPricePurchaseFromReceptionLine(rec),
      receptionLineTotal: lineTotalFromUnit(rec.qtyDeliveredPurchase, unitPricePurchaseFromReceptionLine(rec), rec.blLineTotalHt),
      qtyDelta: null,
      unitPriceDelta: null,
      lineTotalDelta: null,
      hints: ["Ligne présente dans le BL, non retrouvée sur la facture."],
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
