"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";
import type { Supplier } from "@/lib/db";
import { createSupplierInvoiceAction } from "@/app/suppliers/actions";
import { uiBtnPrimarySm, uiError, uiInput, uiSelect, uiSuccess } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  suppliers: Supplier[];
};

export function SupplierInvoiceUpload({ restaurantId, suppliers }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ invoiceId: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      setError("Choisissez un fournisseur.");
      return;
    }
    if (!file) {
      setError("Choisissez un fichier facture.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${restaurantId}/${supplierId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from(SUPPLIER_INVOICES_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadErr) {
      setLoading(false);
      setError(`Échec de l’upload : ${uploadErr.message}`);
      return;
    }

    const result = await createSupplierInvoiceAction({
      restaurantId,
      supplierId,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceDate.trim() || null,
      filePath: path,
      fileName: file.name,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Erreur à l’enregistrement de la facture.");
      return;
    }

    setFile(null);
    setInvoiceNumber("");
    setInvoiceDate("");
    if (inputRef.current) inputRef.current.value = "";
    setSuccess({ invoiceId: result.invoiceId });
    router.refresh();
  }

  if (suppliers.length === 0) {
    return <p className="text-sm text-slate-500">Créez d’abord un fournisseur pour importer une facture.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Fournisseur</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`w-full ${uiSelect}`}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Fichier facture</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            disabled={loading}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
              setSuccess(null);
            }}
            className="block w-full text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-sm"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">N° facture (optionnel)</span>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={`w-full ${uiInput}`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Date facture (optionnel)</span>
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={`w-full ${uiInput}`} />
        </label>
      </div>

      {error ? <p className={uiError}>{error}</p> : null}
      {success ? (
        <div className={uiSuccess}>
          Facture enregistrée.{" "}
          <Link href={`/supplier-invoices/${success.invoiceId}`} className="font-semibold underline">
            Ouvrir
          </Link>
        </div>
      ) : null}

      <button type="submit" disabled={loading || !file || !supplierId} className={uiBtnPrimarySm}>
        {loading ? "Enregistrement et analyse…" : "Enregistrer la facture"}
      </button>
    </form>
  );
}
