import type { InvoiceLineComparison } from "@/lib/invoice-reconciliation";
import { describeBlVsInvoiceLineIssues } from "@/lib/invoice-reconciliation";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatClaimEur(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`;
}

export type SupplierInvoiceClaimSummary = {
  invoiceTotal: number;
  receivedTotal: number;
  delta: number;
  unfavorable: boolean;
  favorable: boolean;
};

/** Totaux globaux facture vs BL (même logique que le bandeau de réclamation). */
export function computeSupplierInvoiceClaimSummary(rows: InvoiceLineComparison[]): SupplierInvoiceClaimSummary | null {
  let invoiceTotal = 0;
  let receivedTotal = 0;
  let hasInvoice = false;
  let hasReceived = false;
  for (const row of rows) {
    if (row.invoiceLineTotal != null && Number.isFinite(row.invoiceLineTotal)) {
      invoiceTotal += row.invoiceLineTotal;
      hasInvoice = true;
    }
    if (row.receptionLineTotal != null && Number.isFinite(row.receptionLineTotal)) {
      receivedTotal += row.receptionLineTotal;
      hasReceived = true;
    }
  }
  if (!hasInvoice || !hasReceived) return null;
  const delta = round2(invoiceTotal - receivedTotal);
  return {
    invoiceTotal: round2(invoiceTotal),
    receivedTotal: round2(receivedTotal),
    delta,
    unfavorable: delta > 0.05,
    favorable: delta < -0.05,
  };
}

function buildIssueLinesDelta(rows: InvoiceLineComparison[]): string {
  return rows
    .filter((row) => row.lineTotalDelta != null && Math.abs(row.lineTotalDelta) > 0.05)
    .map((row) => {
      const label = row.invoiceLabel ?? row.receptionItemName ?? row.receptionLabel ?? "Ligne";
      const d = row.lineTotalDelta ?? 0;
      const direction = d > 0 ? "surfacturée" : "sous-facturée";
      return `- ${label}: ${direction} de ${formatClaimEur(Math.abs(d))}`;
    })
    .join("\n");
}

/**
 * Texte unique pour e-mail (Resend), WhatsApp, SMS et copier-coller.
 * `null` si les totaux ne sont pas calculables ou si l’écart n’est pas défavorable.
 */
export function buildSupplierInvoiceClaimMessage(params: {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  restaurantName: string;
  rows: InvoiceLineComparison[];
}): string | null {
  const summary = computeSupplierInvoiceClaimSummary(params.rows);
  if (!summary?.unfavorable) return null;

  const issueLines = buildIssueLinesDelta(params.rows);
  const motifs = describeBlVsInvoiceLineIssues(params.rows);

  const parts: string[] = [
    "Bonjour,",
    "",
    `Après rapprochement de votre facture${params.invoiceNumber ? ` n° ${params.invoiceNumber}` : ""}${params.invoiceDate ? ` du ${params.invoiceDate}` : ""} avec les BL reçus, nous constatons un écart défavorable.`,
    "",
    `Montant facturé contrôlé : ${formatClaimEur(summary.invoiceTotal)}`,
    `Montant cohérent avec les marchandises reçues : ${formatClaimEur(summary.receivedTotal)}`,
    `Écart en notre défaveur : ${formatClaimEur(Math.abs(summary.delta))}`,
    "",
  ];

  if (issueLines) {
    parts.push("Détail (écarts HT par ligne) :", issueLines, "");
  }

  if (motifs.length > 0) {
    parts.push("Motifs (ligne par ligne) :");
    for (const m of motifs) {
      parts.push(`- ${m}`);
    }
    parts.push("");
  }

  parts.push(
    "Merci de nous transmettre un avoir ou une facture corrigée.",
    "",
    "Cordialement,",
    params.restaurantName.trim() || "Restaurant"
  );

  return parts.join("\n");
}
