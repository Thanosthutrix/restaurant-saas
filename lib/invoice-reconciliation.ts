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
