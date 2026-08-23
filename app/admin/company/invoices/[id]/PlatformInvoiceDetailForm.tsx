"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlatformInvoice } from "@/lib/platform/companyInvoicesDb";
import type { PlatformSupplier } from "@/lib/platform/companyDb";
import {
  PLATFORM_EXPENSE_CATEGORIES,
  getPlatformExpenseCategoryLabel,
} from "@/lib/platform/platformExpenseCategories";
import {
  markPlatformInvoiceReviewedAction,
  updatePlatformInvoiceAction,
  rerunPlatformInvoiceAnalysisAction,
  exportPlatformInvoiceToDropboxAction,
} from "../actions";

type Props = {
  invoice: PlatformInvoice;
  suppliers: PlatformSupplier[];
  fileUrl: string | null;
  extractedLines: {
    label: string;
    quantity: number | null;
    unit: string | null;
    unit_price: number | null;
    line_total: number | null;
  }[];
};

export function PlatformInvoiceDetailForm({ invoice, suppliers, fileUrl, extractedLines }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const ht = String(fd.get("amountHt") ?? "").trim();
    const ttc = String(fd.get("amountTtc") ?? "").trim();

    const result = await updatePlatformInvoiceAction({
      invoiceId: invoice.id,
      supplierId: String(fd.get("supplierId") ?? "") || null,
      supplierName: String(fd.get("supplierName") ?? "") || null,
      invoiceNumber: String(fd.get("invoiceNumber") ?? "") || null,
      invoiceDate: String(fd.get("invoiceDate") ?? "") || null,
      amountHt: ht ? Number(ht.replace(",", ".")) : null,
      amountTtc: ttc ? Number(ttc.replace(",", ".")) : null,
      expenseCategory: String(fd.get("expenseCategory") ?? "") || null,
      notes: String(fd.get("notes") ?? "") || null,
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleMarkReviewed() {
    setLoading(true);
    setError(null);
    const result = await markPlatformInvoiceReviewedAction(invoice.id);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900";

  async function handleRerunAnalysis() {
    setLoading(true);
    setError(null);
    const result = await rerunPlatformInvoiceAnalysisAction(invoice.id);
    setLoading(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function handleDropboxExport() {
    setLoading(true);
    setError(null);
    const result = await exportPlatformInvoiceToDropboxAction(invoice.id);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.alert(`Envoyé vers Dropbox : ${result.pathDisplay}`);
  }

  const supplierLabel =
    suppliers.find((s) => s.id === invoice.supplier_id)?.name ?? invoice.supplier_name ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            invoice.status === "reviewed"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {invoice.status === "reviewed" ? "Prête comptable" : "À contrôler"}
        </span>
        {invoice.expense_category ? (
          <span className="text-xs text-gray-500">
            {getPlatformExpenseCategoryLabel(invoice.expense_category)}
          </span>
        ) : null}
      </div>

      {fileUrl ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-medium text-amber-700 underline"
        >
          Voir le fichier{invoice.file_name ? ` (${invoice.file_name})` : ""}
        </a>
      ) : null}

      {extractedLines.length > 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Lignes extraites</h2>
          <ul className="divide-y divide-gray-50 text-sm">
            {extractedLines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-2">
                <span className="text-gray-800">{l.label}</span>
                <span className="shrink-0 text-gray-500">
                  {l.line_total != null ? `${l.line_total} € HT` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Fournisseur enregistré</span>
            <select name="supplierId" defaultValue={invoice.supplier_id ?? ""} className={inputCls}>
              <option value="">— Saisie libre —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Nom fournisseur (si libre)</span>
            <input name="supplierName" defaultValue={supplierLabel} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">N° facture</span>
            <input name="invoiceNumber" defaultValue={invoice.invoice_number ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Date</span>
            <input
              type="date"
              name="invoiceDate"
              defaultValue={invoice.invoice_date ?? ""}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Montant HT</span>
            <input
              name="amountHt"
              defaultValue={invoice.amount_ht ?? ""}
              inputMode="decimal"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Montant TTC</span>
            <input
              name="amountTtc"
              defaultValue={invoice.amount_ttc ?? ""}
              inputMode="decimal"
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-gray-500">Poste comptable</span>
            <select name="expenseCategory" defaultValue={invoice.expense_category ?? ""} className={inputCls}>
              <option value="">— Non classé —</option>
              {PLATFORM_EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-gray-500">Notes internes</span>
            <textarea name="notes" rows={3} defaultValue={invoice.notes ?? ""} className={inputCls} />
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            Enregistrer
          </button>
          {invoice.status === "draft" ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleMarkReviewed}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Marquer prête comptable
            </button>
          ) : null}
          {invoice.file_path ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleRerunAnalysis}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Relancer l&apos;analyse IA
            </button>
          ) : null}
          {invoice.status === "reviewed" && invoice.file_path ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleDropboxExport}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Envoyer vers Dropbox
            </button>
          ) : null}
        </div>
      </form>

      <Link href="/admin/company/invoices" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux factures
      </Link>
    </div>
  );
}
