"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";
import type { PlatformSupplier } from "@/lib/platform/companyDb";
import { PLATFORM_EXPENSE_CATEGORIES } from "@/lib/platform/platformExpenseCategories";
import { createPlatformInvoiceAction } from "./actions";

type Props = {
  companyId: string;
  suppliers: PlatformSupplier[];
};

export function PlatformInvoiceUpload({ companyId, suppliers }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [supplierName, setSupplierName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [amountTtc, setAmountTtc] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const resolvedSupplierId = supplierId || null;
    const resolvedName = supplierId
      ? suppliers.find((s) => s.id === supplierId)?.name ?? null
      : supplierName.trim() || null;

    if (!resolvedSupplierId && !resolvedName) {
      setError("Indiquez un fournisseur.");
      return;
    }

    setLoading(true);
    let filePath: string | undefined;
    let fileName: string | undefined;

    if (file) {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `platform/${companyId}/${resolvedSupplierId ?? "misc"}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from(SUPPLIER_INVOICES_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) {
        setLoading(false);
        setError(`Échec upload : ${uploadErr.message}`);
        return;
      }
      filePath = path;
      fileName = file.name;
    }

    const ttc = amountTtc.trim() ? Number(amountTtc.replace(",", ".")) : null;

    const result = await createPlatformInvoiceAction({
      supplierId: resolvedSupplierId,
      supplierName: resolvedName,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceDate.trim() || null,
      filePath,
      fileName,
      amountTtc: ttc != null && !Number.isNaN(ttc) ? ttc : null,
      expenseCategory: expenseCategory || null,
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.invoiceId) {
      router.push(`/admin/company/invoices/${result.invoiceId}`);
    } else {
      router.refresh();
    }
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Importer une facture</h2>

      {suppliers.length > 0 ? (
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Fournisseur</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={inputCls}
          >
            <option value="">— Autre (saisie libre) —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {!supplierId ? (
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Nom du fournisseur</span>
          <input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className={inputCls}
            placeholder="Vercel, Supabase…"
          />
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">N° facture</span>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Date</span>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Montant TTC (€)</span>
          <input
            value={amountTtc}
            onChange={(e) => setAmountTtc(e.target.value)}
            inputMode="decimal"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Poste comptable</span>
          <select
            value={expenseCategory}
            onChange={(e) => setExpenseCategory(e.target.value)}
            className={inputCls}
          >
            <option value="">— Auto —</option>
            {PLATFORM_EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-gray-500">Fichier (PDF ou image)</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          disabled={loading}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm text-gray-600"
        />
      </label>

      {suppliers.length === 0 ? (
        <p className="text-xs text-gray-500">
          Astuce :{" "}
          <Link href="/admin/company" className="text-amber-700 underline">
            ajoutez des fournisseurs
          </Link>{" "}
          pour accélérer la saisie.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {loading ? "Enregistrement…" : "Enregistrer la facture"}
      </button>
    </form>
  );
}
