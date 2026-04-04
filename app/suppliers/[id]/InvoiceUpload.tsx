"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";
import { createSupplierInvoiceAction } from "../actions";

type Props = {
  restaurantId: string;
  supplierId: string;
};

export function InvoiceUpload({ restaurantId, supplierId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ invoiceId: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choisissez un fichier.");
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
      setError("Échec de l'upload : " + uploadErr.message);
      setLoading(false);
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
    if (result.ok) {
      setFile(null);
      setInvoiceNumber("");
      setInvoiceDate("");
      if (inputRef.current) inputRef.current.value = "";
      setSuccess({ invoiceId: result.invoiceId });
      router.refresh();
    } else {
      setError(result.error ?? "Erreur à l'enregistrement de la facture.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Fichier facture
        </label>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
            setSuccess(null);
          }}
          disabled={loading}
          className="block w-full text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-sm"
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            N° facture (optionnel)
          </label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="ex. FAC-2024-001"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Date facture (optionnel)
          </label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {success && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p className="font-medium">Facture enregistrée.</p>
          <p className="mt-1">
            <Link href={`/supplier-invoices/${success.invoiceId}`} className="underline underline-offset-2">
              Ouvrir la facture
            </Link>
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !file}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Enregistrement et analyse…" : "Enregistrer la facture"}
      </button>
    </form>
  );
}
