import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { getAdminInvoiceContext } from "@/lib/admin/invoicesDb";
import { getAdminInvoiceStatusLabel } from "@/lib/admin/invoiceTypes";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierInvoiceWithDeliveryNotes } from "@/lib/db";
import { AdminInvoiceImpersonateButton } from "./AdminInvoiceImpersonateButton";

type Props = { params: Promise<{ id: string }> };

function formatEur(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export default async function AdminInvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  const { invoice, ownerId, ownerEmail } = await getAdminInvoiceContext(id);
  if (!invoice) notFound();

  if (user) {
    await logAdminSupportActivity({
      authorId: user.id,
      restaurantId: invoice.restaurant_id,
      action: "invoice_viewed",
      summary: `Consultation facture ${invoice.invoice_number ?? id.slice(0, 8)} — ${invoice.restaurant_name}`,
      metadata: { invoiceId: id, supplierName: invoice.supplier_name },
    });
  }

  const detailRes = await getSupplierInvoiceWithDeliveryNotes(id);
  const detail = detailRes.data;

  let reconciliationHint: string | null = null;
  let issueCount = 0;
  if (detail) {
    issueCount = detail.invoice_line_comparisons.filter((c) => c.status !== "ok").length;
    reconciliationHint =
      detail.invoice_reconciliation.hints[0] ??
      (issueCount > 0 ? `${issueCount} écart(s) ligne à ligne` : "Rapprochement OK");
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        href="/admin/invoices"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
      >
        <ArrowLeft size={14} />
        Retour aux factures
      </Link>

      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100">
          <FileText className="text-stone-600" size={22} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {invoice.invoice_number ?? "Facture sans numéro"}
          </h1>
          <p className="text-sm text-gray-500">
            {invoice.restaurant_name} · {invoice.supplier_name}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            invoice.status === "reviewed"
              ? "bg-green-50 text-green-700"
              : invoice.status === "linked"
                ? "bg-amber-50 text-amber-700"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {getAdminInvoiceStatusLabel(invoice.status)}
        </span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <InfoCard label="Montant HT" value={formatEur(invoice.amount_ht)} />
        <InfoCard label="Montant TTC" value={formatEur(invoice.amount_ttc)} />
        <InfoCard label="BL liés" value={String(invoice.delivery_notes_count)} />
        <InfoCard
          label="Analyse IA"
          value={invoice.analysis_status ?? "—"}
        />
      </div>

      {reconciliationHint && (
        <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-sm text-amber-900">
          Rapprochement : <strong>{reconciliationHint}</strong>
          {issueCount > 0 && <> — {issueCount} ligne{issueCount > 1 ? "s" : ""} avec écart</>}
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Actions support</h2>
        <p className="text-xs text-gray-500">
          Ouvrez la facture dans l&apos;app client via impersonation pour le rapprochement détaillé.
        </p>
        {ownerId && ownerEmail ? (
          <AdminInvoiceImpersonateButton
            ownerId={ownerId}
            ownerEmail={ownerEmail}
            invoicePath={`/supplier-invoices/${id}`}
          />
        ) : (
          <p className="text-sm text-gray-400">Propriétaire introuvable.</p>
        )}
        <Link
          href={`/admin/restaurants/${invoice.restaurant_id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          Fiche client <ExternalLink size={13} />
        </Link>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-semibold text-gray-900">{value}</p>
    </div>
  );
}
