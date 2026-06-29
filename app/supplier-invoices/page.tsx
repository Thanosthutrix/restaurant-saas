import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  getSupplierInvoicesForRestaurant,
  getSuppliers,
  getValidatedDeliveryNotesAwaitingInvoice,
} from "@/lib/db";
import { FileText } from "lucide-react";
import { uiBadgeAmber, uiBadgeEmerald, uiBadgeSlate, uiCard, uiLead, uiSectionTitleSm } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SupplierInvoiceUpload } from "./SupplierInvoiceUpload";

const STATUS_LABELS: Record<string, string> = {
  draft: "À traiter",
  linked: "À contrôler",
  reviewed: "Prête comptable",
};

function statusBadge(status: string) {
  if (status === "reviewed") return uiBadgeEmerald;
  if (status === "linked") return uiBadgeAmber;
  return uiBadgeSlate;
}

export default async function SupplierInvoicesPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [invoicesRes, suppliersRes, awaitingRes] = await Promise.all([
    getSupplierInvoicesForRestaurant(restaurant.id, { includeFileFields: false }),
    getSuppliers(restaurant.id, true),
    getValidatedDeliveryNotesAwaitingInvoice(restaurant.id),
  ]);

  const invoices = invoicesRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const awaitingDeliveryNotes = awaitingRes.data ?? [];
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  const draftCount = invoices.filter((i) => i.status === "draft").length;
  const linkedCount = invoices.filter((i) => i.status === "linked").length;
  const reviewedCount = invoices.filter((i) => i.status === "reviewed").length;

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[{ label: "Achats & stock", href: "/achats" }, { label: "Factures fournisseurs" }]}
        title="Factures fournisseurs"
        subtitle="Import, lecture IA, rapprochement avec les réceptions validées, contrôle des écarts et préparation comptable."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">À traiter</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{draftCount}</p>
        </div>
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">À contrôler</p>
          <p className="mt-1 text-2xl font-semibold text-amber-800">{linkedCount}</p>
        </div>
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">Prêtes comptable</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800">{reviewedCount}</p>
        </div>
        <div className={uiCard}>
          <p className="text-xs font-medium text-stone-500">BL validés sans facture</p>
          <p className="mt-1 text-2xl font-semibold text-copper-800">{awaitingDeliveryNotes.length}</p>
        </div>
      </div>

      <section className={`${uiCard} space-y-4`}>
        <h2 className={uiSectionTitleSm}>Importer une facture</h2>
        <SupplierInvoiceUpload restaurantId={restaurant.id} suppliers={suppliers} />
      </section>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Sandbox comptable</h2>
        <p className={uiLead}>
          Les factures marquées “Prêtes comptable” peuvent être exportées au format CSV avec lien fichier, fournisseur,
          numéro et montants. C’est la première étape avant une intégration API comptable/PDP.
        </p>
        <p>
          <Link
            href="/supplier-invoices/accounting-export"
            className="inline-flex rounded-xl bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            Exporter les factures prêtes (CSV)
          </Link>
        </p>
      </section>

      <section className={uiCard}>
        <h2 className={uiSectionTitleSm}>Réceptions validées en attente de facture</h2>
        {awaitingDeliveryNotes.length === 0 ? (
          <p className={`mt-2 ${uiLead}`}>Aucun BL validé en attente de facture.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {awaitingDeliveryNotes.slice(0, 12).map((dn) => {
              const supplier = supplierById.get(dn.supplier_id);
              const displayDate = dn.delivery_date ?? dn.created_at;
              return (
                <li key={dn.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{supplier?.name ?? "Fournisseur"}</p>
                    <p className="text-xs text-stone-500">
                      {displayDate
                        ? new Date(displayDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}{" "}
                      · {dn.lines_count} ligne{dn.lines_count !== 1 ? "s" : ""} · BL validé
                    </p>
                  </div>
                  <Link href={`/receiving/${dn.id}`} className="text-sm font-semibold text-copper-800 underline">
                    Ouvrir le BL
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className={uiSectionTitleSm}>Toutes les factures</h2>
        {invoicesRes.error ? (
          <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {invoicesRes.error.message}
          </p>
        ) : invoices.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={FileText}
              title="Aucune facture enregistrée"
              description="Importez une facture fournisseur ci-dessus pour la rapprocher de vos réceptions."
              compact
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {invoices.map((inv) => {
              const supplier = supplierById.get(inv.supplier_id);
              return (
                <li key={inv.id}>
                  <Link
                    href={`/supplier-invoices/${inv.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-3.5 py-3 shadow-sm transition hover:border-copper-200 hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                      <FileText className="h-5 w-5 text-copper-700" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-stone-900 transition group-hover:text-copper-700">
                        {inv.invoice_number || "Facture sans numéro"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-stone-500">
                        {supplier?.name ?? "Fournisseur"} ·{" "}
                        {inv.invoice_date
                          ? new Date(inv.invoice_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                          : inv.created_at
                            ? new Date(inv.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                            : "—"}
                        {inv.amount_ht != null ? ` · ${Number(inv.amount_ht).toLocaleString("fr-FR")} € HT` : ""}
                      </span>
                    </span>
                    <span className={`${statusBadge(inv.status)} shrink-0`}>{STATUS_LABELS[inv.status] ?? inv.status}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
