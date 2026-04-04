"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSupplierInvoiceMetadataAction } from "./actions";
import type { SupplierInvoice } from "@/lib/db";

type Props = {
  invoice: Pick<
    SupplierInvoice,
    "id" | "invoice_number" | "invoice_date" | "amount_ht" | "amount_ttc"
  >;
  restaurantId: string;
};

function formatDateForInput(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatAmount(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export function InvoiceMetadataForm({ invoice, restaurantId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(() => {
      updateSupplierInvoiceMetadataAction(invoice.id, restaurantId, formData).then((res) => {
        if (res.success) {
          setMessage({ type: "success", text: "Informations enregistrées." });
          router.refresh();
        } else {
          setMessage({ type: "error", text: res.error });
        }
      });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="invoice_number" className="mb-1 block text-sm font-medium text-slate-700">
            Numéro de facture
          </label>
          <input
            id="invoice_number"
            name="invoice_number"
            type="text"
            defaultValue={invoice.invoice_number ?? ""}
            placeholder="Ex. FAC-2024-001"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />
        </div>
        <div>
          <label htmlFor="invoice_date" className="mb-1 block text-sm font-medium text-slate-700">
            Date facture
          </label>
          <input
            id="invoice_date"
            name="invoice_date"
            type="date"
            defaultValue={formatDateForInput(invoice.invoice_date)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />
        </div>
        <div>
          <label htmlFor="amount_ht" className="mb-1 block text-sm font-medium text-slate-700">
            Montant HT (€) — base du rapprochement avec les lignes
          </label>
          <input
            id="amount_ht"
            name="amount_ht"
            type="text"
            inputMode="decimal"
            defaultValue={formatAmount(invoice.amount_ht)}
            placeholder="0.00"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />
        </div>
        <div>
          <label htmlFor="amount_ttc" className="mb-1 block text-sm font-medium text-slate-700">
            Montant TTC (€) — total à payer (pied de facture)
          </label>
          <input
            id="amount_ttc"
            name="amount_ttc"
            type="text"
            inputMode="decimal"
            defaultValue={formatAmount(invoice.amount_ttc)}
            placeholder="0.00"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />
        </div>
      </div>

      {message && (
        <p
          role="alert"
          className={
            message.type === "success"
              ? "text-sm font-medium text-green-700"
              : "text-sm font-medium text-red-700"
          }
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Enregistrer les informations"}
      </button>
    </form>
  );
}
