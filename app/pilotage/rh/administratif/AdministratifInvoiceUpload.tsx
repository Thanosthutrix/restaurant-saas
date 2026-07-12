"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";
import type { Supplier } from "@/lib/db";
import { createSupplierInvoiceAction } from "@/app/suppliers/actions";
import type { ExpenseCategory } from "@/lib/pocket/expenseCategories";
import { uiBtnPrimarySm, uiError, uiFileInput, uiSelect } from "@/components/ui/premium";

export function AdministratifInvoiceUpload({
  restaurantId,
  suppliers,
  expenseCategory,
}: {
  restaurantId: string;
  suppliers: Supplier[];
  expenseCategory: ExpenseCategory;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      setError("Choisissez un fournisseur.");
      return;
    }
    if (!file) {
      setError("Choisissez un fichier PDF ou image.");
      return;
    }

    setError(null);
    setLoading(true);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${restaurantId}/${supplierId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(SUPPLIER_INVOICES_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadErr) {
      setLoading(false);
      setError(`Échec de l'upload : ${uploadErr.message}`);
      return;
    }

    const result = await createSupplierInvoiceAction({
      restaurantId,
      supplierId,
      filePath: path,
      fileName: file.name,
      expenseCategory,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Erreur à l'enregistrement de la facture.");
      return;
    }

    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  if (suppliers.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        <Link href="/suppliers" className="font-semibold text-copper-800 underline">
          Ajoutez un fournisseur
        </Link>{" "}
        pour déposer une facture.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs font-medium text-stone-500">Déposer une nouvelle facture</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1">
          <span className="sr-only">Fournisseur</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className={uiSelect}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 space-y-1">
          <span className="sr-only">Fichier</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={uiFileInput}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className={`${uiBtnPrimarySm} inline-flex shrink-0 items-center gap-1.5`}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {loading ? "Import…" : "Importer"}
        </button>
      </div>
      {error ? <p className={uiError}>{error}</p> : null}
    </form>
  );
}
