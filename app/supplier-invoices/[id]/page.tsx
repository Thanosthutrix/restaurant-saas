import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, FileText } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import {
  getSupplierInvoiceWithDeliveryNotes,
  getSupplierInvoiceFileUrl,
  getSupplier,
  getDeliveryNotesBySupplierNotLinked,
} from "@/lib/db";
import { LinkReceptionsForm } from "./LinkReceptionsForm";
import { InvoiceMetadataForm } from "./InvoiceMetadataForm";
import { InvoiceAnalysisSection } from "./InvoiceAnalysisSection";
import { RerunInvoiceAnalysisButton } from "./RerunInvoiceAnalysisButton";
import { MarkInvoiceReviewedButton } from "./MarkInvoiceReviewedButton";
import { InvoiceLineComparisonTable } from "./InvoiceLineComparisonTable";
import { UnlinkReceptionButton } from "./UnlinkReceptionButton";
import { InvoiceExtractedLinesEditor } from "./InvoiceExtractedLinesEditor";
import { InvoiceClaimActionsPanel } from "./InvoiceClaimActionsPanel";
import { ExportInvoiceToDropboxButton } from "./ExportInvoiceToDropboxButton";
import { describeBlVsInvoiceLineIssues } from "@/lib/invoice-reconciliation";
import { isDropboxExportConfigured } from "@/lib/dropboxClient";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { uiCard } from "@/components/ui/premium";

type Props = { params: Promise<{ id: string }> };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-stone-100 text-stone-600" },
  linked: { label: "Liée", cls: "bg-amber-100 text-amber-900" },
  reviewed: { label: "Relue", cls: "bg-emerald-100 text-emerald-800" },
};

export default async function SupplierInvoicePage({ params }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { id } = await params;
  const { data: invoice, error } = await getSupplierInvoiceWithDeliveryNotes(id);
  if (error || !invoice || invoice.restaurant_id !== restaurant.id) notFound();

  const [supplierRes, unlinkedRes] = await Promise.all([
    getSupplier(invoice.supplier_id),
    getDeliveryNotesBySupplierNotLinked(invoice.supplier_id, restaurant.id),
  ]);
  const supplier = supplierRes.data ?? null;
  const unlinkedDeliveryNotes = unlinkedRes.data ?? [];

  const fileUrl = invoice.file_url ?? getSupplierInvoiceFileUrl(invoice.file_path);
  const c = invoice.control_summary;
  const reco = invoice.invoice_reconciliation;
  const lineIssueDescriptions = describeBlVsInvoiceLineIssues(invoice.invoice_line_comparisons);
  const dropboxExportConfigured = isDropboxExportConfigured();
  const dropboxSaverEnabled = Boolean(process.env.NEXT_PUBLIC_DROPBOX_APP_KEY);
  const CONTROL_STATE_LABELS: Record<string, string> = {
    none: "Aucune réception liée",
    review: "Points à vérifier",
    ready: "Prêt à vérifier",
  };
  const controlLabel = CONTROL_STATE_LABELS[c.control_state] ?? c.control_state;
  const status = STATUS_META[invoice.status] ?? { label: invoice.status, cls: "bg-stone-100 text-stone-600" };

  return (
    <PageContainer>
      <PageHeader
        accentIcon={FileText}
        accentTone="bg-amber-50 text-amber-700"
        breadcrumbs={[
          { label: "Achats & stock", href: "/achats" },
          { label: "Factures fournisseurs", href: "/supplier-invoices" },
          { label: "Facture" },
        ]}
        title={`Facture ${invoice.invoice_number || "sans numéro"}`}
        subtitle={supplier?.name ? `Fournisseur : ${supplier.name}` : undefined}
      />

      {/* Méta facture */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${status.cls}`}>
          {status.label}
        </span>
        {invoice.invoice_date ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-stone-600">
            <CalendarDays className="h-4 w-4 text-stone-400" aria-hidden />
            {new Date(invoice.invoice_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        ) : null}
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-copper-700 underline decoration-copper-300 underline-offset-2 hover:text-copper-600"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Voir le fichier facture
          </a>
        ) : null}
      </div>

      {/* Analyse IA + lignes extraites + infos facture */}
      <section className={`${uiCard} space-y-6`}>
        <div>
          <InvoiceAnalysisSection
            analysisView={invoice.analysis_view}
            analysis_status={invoice.analysis_status ?? null}
            analysis_error={invoice.analysis_error ?? null}
          />
          {invoice.file_path || invoice.file_url ? (
            <RerunInvoiceAnalysisButton invoiceId={invoice.id} restaurantId={restaurant.id} />
          ) : null}
          <InvoiceExtractedLinesEditor
            invoiceId={invoice.id}
            restaurantId={restaurant.id}
            initialLines={invoice.analysis_view?.lines ?? []}
          />
        </div>

        <div className="border-t border-stone-100 pt-4">
          <h2 className="mb-3 text-sm font-semibold text-stone-800">Modifier les informations de la facture</h2>
          <InvoiceMetadataForm
            invoice={{
              id: invoice.id,
              invoice_number: invoice.invoice_number,
              invoice_date: invoice.invoice_date,
              amount_ht: invoice.amount_ht,
              amount_ttc: invoice.amount_ttc,
              expense_category: invoice.expense_category ?? null,
            }}
            restaurantId={restaurant.id}
          />
        </div>
      </section>

      {/* Contrôle */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm sm:p-5">
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Contrôle</h2>
        <p className="text-sm font-semibold text-stone-900">{controlLabel}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-600 sm:grid-cols-4">
          <span>Réceptions liées : {c.linked_receptions_count}</span>
          <span>Lignes au total : {c.total_lines}</span>
          <span>Lignes avec produit : {c.lines_with_product}</span>
          <span>Lignes sans produit : {c.lines_without_product}</span>
        </dl>
        <div className="mt-4 border-t border-amber-200/80 pt-3">
          <h3 className="mb-2 text-xs font-semibold text-stone-700">Contrôle principal : BL reçus vs facture</h3>
          <p className="mb-2 text-xs text-stone-500">
            Ce contrôle compare ce que le fournisseur facture avec ce qui a réellement été reçu et valorisé dans les BL
            liés.
          </p>
          <InvoiceClaimActionsPanel
            invoiceId={invoice.id}
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            supplierName={supplier?.name ?? "fournisseur"}
            supplierEmail={supplier?.email ?? null}
            supplierPhone={supplier?.phone ?? null}
            supplierWhatsapp={supplier?.whatsapp_phone ?? null}
            invoiceNumber={invoice.invoice_number}
            invoiceDate={invoice.invoice_date}
            rows={invoice.invoice_line_comparisons}
            lineIssueDetails={lineIssueDescriptions}
          />
        </div>
        <div className="mt-4 border-t border-amber-200/80 pt-3">
          <h3 className="mb-2 text-xs font-semibold text-stone-600">
            Contrôle secondaire : cohérence interne de la facture
          </h3>
          <p className="mb-2 text-xs text-stone-500">
            Ce contrôle vérifie seulement que la somme des lignes lues sur la facture correspond au total HT saisi sur la
            facture. Il ne remplace pas le contrôle BL vs facture ci-dessus.
          </p>
          <dl className="grid grid-cols-1 gap-1 text-xs text-stone-600 sm:grid-cols-2">
            <span>Lignes extraites (table) : {reco.extracted_lines_count}</span>
            <span>Lignes réceptions liées : {reco.reception_lines_count}</span>
            {reco.sum_extracted_line_totals != null && (
              <span className="sm:col-span-2">
                Somme des totaux ligne (rapprochement HT) :{" "}
                {reco.sum_extracted_line_totals.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                € HT
              </span>
            )}
            {reco.amount_ht_on_invoice != null && (
              <span>Montant HT facture (saisi) : {reco.amount_ht_on_invoice.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
            )}
            {reco.amount_ttc_on_invoice != null && (
              <span>Montant TTC facture (saisi) : {reco.amount_ttc_on_invoice.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
            )}
            {reco.delta_ht_vs_sum_lines != null && reco.amount_ht_on_invoice != null && reco.sum_extracted_line_totals != null && (
              <span className="sm:col-span-2">
                Écart interne facture (somme lignes − HT facture) :{" "}
                {reco.delta_ht_vs_sum_lines > 0 ? "+" : ""}
                {reco.delta_ht_vs_sum_lines.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            )}
            {reco.ttc_minus_ht_invoice != null && (
              <span className="sm:col-span-2">
                TTC − HT (totaux saisis, dont TVA) :{" "}
                {reco.ttc_minus_ht_invoice.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            )}
            {reco.fuzzy_matched_extracted_count > 0 && reco.reception_lines_count > 0 && (
              <span className="sm:col-span-2">
                Libellés approx. rapprochés : {reco.fuzzy_matched_extracted_count} / {reco.extracted_lines_count} ligne(s) facture
              </span>
            )}
          </dl>
          {reco.hints.length > 0 && (
            <ul className="mt-2 space-y-2">
              {reco.hints.map((h, i) => (
                <li key={i} className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Écarts ligne par ligne */}
      <section className={uiCard}>
        <h2 className="mb-2 text-sm font-semibold text-stone-800">Écarts ligne par ligne</h2>
        <p className="mb-3 text-xs text-stone-500">
          La colonne « Écart ligne HT » correspond au montant facturé pour la ligne moins le montant valorisé sur le BL
          (même logique que le bandeau ci-dessus). Les PU BL peuvent être repris sur la facture si le BL n’a pas de
          tarif : l’écart HT reste la référence.
        </p>
        {invoice.invoice_line_comparisons.length > 0 && lineIssueDescriptions.length === 0 ? (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Aucune anomalie ligne par ligne détectée pour le rapprochement BL / facture.
          </div>
        ) : null}
        <InvoiceLineComparisonTable
          rows={invoice.invoice_line_comparisons}
          invoiceId={invoice.id}
          restaurantId={restaurant.id}
          invoiceLines={invoice.analysis_view?.lines ?? []}
        />
      </section>

      {/* Validation comptable */}
      {invoice.status !== "reviewed" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm sm:p-5">
          <h2 className="mb-2 text-sm font-semibold text-emerald-950">Validation comptable</h2>
          <p className="mb-3 text-sm text-emerald-900">
            {invoice.delivery_notes.length > 0
              ? "Après rapprochement des BL et contrôle des écarts, marquez la facture comme prête pour transfert comptable."
              : "Contrôlez les montants et lignes de la facture, puis validez pour le transfert comptable — avec ou sans BL lié."}
          </p>
          <MarkInvoiceReviewedButton
            invoiceId={invoice.id}
            restaurantId={restaurant.id}
            hasLinkedReceptions={invoice.delivery_notes.length > 0}
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-emerald-900">Facture prête comptable.</p>
          {dropboxSaverEnabled || dropboxExportConfigured ? (
            <div className="mt-3">
              <ExportInvoiceToDropboxButton
                invoiceId={invoice.id}
                restaurantId={restaurant.id}
                saverEnabled={dropboxSaverEnabled}
                serverUploadEnabled={dropboxExportConfigured}
              />
            </div>
          ) : null}
        </section>
      )}

      {/* Rapprochement */}
      <section className={uiCard}>
        <h2 className="mb-3 text-sm font-semibold text-stone-800">Rapprochement</h2>
        <div className="space-y-2">
          {invoice.delivery_notes.length === 0 ? (
            <p className="text-sm text-stone-500">Aucune réception liée pour l’instant.</p>
          ) : (
            <ul className="space-y-2">
              {invoice.delivery_notes.map((dn) => (
                <li
                  key={dn.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200/70 px-3 py-2"
                >
                  <Link href={`/receiving/${dn.id}`} className="text-sm font-medium text-copper-700 underline decoration-copper-300 underline-offset-2 hover:text-copper-600">
                    Réception du{" "}
                    {dn.created_at
                      ? new Date(dn.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                      : "—"}
                  </Link>
                  <span className="text-xs text-stone-500">
                    {dn.lines_count} ligne{dn.lines_count !== 1 ? "s" : ""} · {dn.status}
                    {dn.lines_without_product > 0 && (
                      <span className="ml-1 text-amber-600">· {dn.lines_without_product} sans produit</span>
                    )}
                  </span>
                  <UnlinkReceptionButton invoiceId={invoice.id} deliveryNoteId={dn.id} restaurantId={restaurant.id} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 border-t border-stone-100 pt-4">
          <h3 className="mb-2 text-xs font-semibold text-stone-600">Lier des réceptions</h3>
          <LinkReceptionsForm
            invoiceId={invoice.id}
            restaurantId={restaurant.id}
            unlinkedDeliveryNotes={unlinkedDeliveryNotes}
          />
        </div>
      </section>
    </PageContainer>
  );
}
