import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Download } from "lucide-react";
import { getPlatformCompany, listPlatformSuppliers } from "@/lib/platform/companyDb";
import { listPlatformInvoices } from "@/lib/platform/companyInvoicesDb";
import { getPlatformPaConnection } from "@/lib/platform/platformPaDb";
import { getPlatformExpenseCategoryLabel } from "@/lib/platform/platformExpenseCategories";
import { PlatformInvoiceUpload } from "./PlatformInvoiceUpload";
import { PlatformPaConnectionCard } from "./PlatformPaConnectionCard";

const STATUS_LABELS = {
  draft: "À contrôler",
  reviewed: "Prête comptable",
} as const;

function formatEur(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("fr-FR");
}

export default async function AdminCompanyInvoicesPage() {
  const company = await getPlatformCompany();
  if (!company) redirect("/admin/company");

  const [invoices, suppliers, paConnection] = await Promise.all([
    listPlatformInvoices(company.id),
    listPlatformSuppliers(company.id),
    getPlatformPaConnection(company.id),
  ]);

  const draftCount = invoices.filter((i) => i.status === "draft").length;
  const reviewedCount = invoices.filter((i) => i.status === "reviewed").length;
  const supplierById = new Map(suppliers.map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-4xl pb-4">
      <div className="mb-6">
        <Link href="/admin/company" className="text-xs text-gray-500 hover:text-gray-700">
          ← Ma société
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <FileText size={22} className="text-amber-600" />
          Factures
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {company.legal_name} — import, contrôle et préparation comptable.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">À contrôler</p>
          <p className="text-2xl font-bold text-amber-700">{draftCount}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Prêtes comptable</p>
          <p className="text-2xl font-bold text-emerald-700">{reviewedCount}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:col-span-1">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
        </div>
      </div>

      <div className="mb-6">
        <PlatformPaConnectionCard
          connection={
            paConnection
              ? {
                  enrollmentStatus: paConnection.enrollment_status,
                  companyVerificationStatus: paConnection.company_verification_status,
                  lastInvoiceReceivedAt: paConnection.last_invoice_received_at,
                  lastError: paConnection.last_error,
                }
              : null
          }
        />
      </div>

      {reviewedCount > 0 ? (
        <div className="mb-6">
          <a
            href="/admin/company/invoices/accounting-export"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Download size={16} aria-hidden />
            Export CSV comptable ({reviewedCount})
          </a>
        </div>
      ) : null}

      <PlatformInvoiceUpload companyId={company.id} suppliers={suppliers} />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Toutes les factures</h2>
        {invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            Aucune facture — importez votre première facture ci-dessus.
          </p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => {
              const supplierLabel =
                (inv.supplier_id ? supplierById.get(inv.supplier_id) : null) ??
                inv.supplier_name ??
                "Fournisseur";
              return (
                <li key={inv.id}>
                  <Link
                    href={`/admin/company/invoices/${inv.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm transition hover:border-amber-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{supplierLabel}</p>
                      <p className="text-xs text-gray-500">
                        {inv.invoice_number ? `N° ${inv.invoice_number} · ` : ""}
                        {formatDate(inv.invoice_date)}
                        {inv.source === "pa_reception" ? " · PA" : ""}
                        {inv.expense_category
                          ? ` · ${getPlatformExpenseCategoryLabel(inv.expense_category)}`
                          : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{formatEur(inv.amount_ttc)}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.status === "reviewed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
