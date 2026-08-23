"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import {
  createPlatformEmittedInvoiceAction,
  emitPlatformEmittedInvoiceAction,
  suggestEmittedInvoiceNumberAction,
} from "./actions";
import type { PlatformCustomer, PlatformEmittedInvoice } from "@/lib/platform/emittedInvoicesDb";

type LineDraft = {
  label: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
};

type Props = {
  customers: PlatformCustomer[];
  invoices: PlatformEmittedInvoice[];
  paConnected: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Émise",
  paid: "Payée",
  cancelled: "Annulée",
};

function formatEur(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function emptyLine(): LineDraft {
  return { label: "", quantity: "1", unitPrice: "", vatRate: "20" };
}

export function EmittedInvoicesPanel({ customers, invoices, paConnected }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const previewTotals = useMemo(() => {
    let ht = 0;
    let ttc = 0;
    for (const line of lines) {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      const rate = Number(line.vatRate) || 0;
      const net = qty * price;
      ht += net;
      ttc += net * (1 + rate / 100);
    }
    return { ht: Math.round(ht * 100) / 100, ttc: Math.round(ttc * 100) / 100 };
  }, [lines]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function loadSuggestedNumber() {
    const res = await suggestEmittedInvoiceNumberAction();
    if (res.ok) setInvoiceNumber(res.data!.number);
  }

  function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await createPlatformEmittedInvoiceAction({
        customerId,
        invoiceNumber: invoiceNumber || null,
        invoiceDate,
        dueDate: dueDate || null,
        lines: lines.map((l) => ({
          label: l.label,
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
          vatRate: Number(l.vatRate) || 20,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Brouillon créé.");
      setLines([emptyLine()]);
      router.refresh();
    });
  }

  function handleEmit(invoiceId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await emitPlatformEmittedInvoiceAction(invoiceId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `Facture transmise à la PA (id ${res.data!.paInvoiceId}${res.data!.lifecycleStatus ? ` · ${res.data!.lifecycleStatus}` : ""}).`
      );
      router.refresh();
    });
  }

  const drafts = invoices.filter((i) => i.status === "draft");
  const emitted = invoices.filter((i) => i.status !== "draft");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">Nouveau brouillon</h2>
        <p className="mb-4 text-xs text-gray-500">
          Créez la facture puis émettez-la via le Portail Agréé une fois validée.
        </p>

        {customers.length === 0 ? (
          <p className="text-sm italic text-gray-400">Ajoutez d&apos;abord un client.</p>
        ) : (
          <form onSubmit={handleCreateDraft} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-xs font-medium text-gray-500">Client</span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-xs font-medium text-gray-500">N° facture</span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="FAC-2026-…"
                  />
                  <button
                    type="button"
                    onClick={() => void loadSuggestedNumber()}
                    className="shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Auto
                  </button>
                </div>
              </label>
              <label>
                <span className="text-xs font-medium text-gray-500">Date</span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-medium text-gray-500">Échéance (optionnel)</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500">Lignes</p>
              {lines.map((line, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[2fr_4rem_6rem_4rem_auto]">
                  <input
                    value={line.label}
                    onChange={(e) => updateLine(index, { label: e.target.value })}
                    placeholder="Libellé"
                    required
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    inputMode="decimal"
                    className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
                    title="Quantité"
                  />
                  <input
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                    inputMode="decimal"
                    placeholder="PU HT"
                    required
                    className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
                  />
                  <input
                    value={line.vatRate}
                    onChange={(e) => updateLine(index, { vatRate: e.target.value })}
                    inputMode="decimal"
                    className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
                    title="TVA %"
                  />
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                      className="text-xs text-red-600"
                    >
                      Retirer
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="text-xs font-medium text-amber-700 hover:underline"
              >
                + Ligne
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
              <p className="text-sm text-gray-600">
                Total : {formatEur(previewTotals.ht)} HT · {formatEur(previewTotals.ttc)} TTC
              </p>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                Enregistrer brouillon
              </button>
            </div>
          </form>
        )}
      </section>

      {drafts.length > 0 ? (
        <section className="rounded-xl border border-amber-100 bg-amber-50/40 p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Brouillons à émettre</h2>
          <ul className="space-y-2">
            {drafts.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white bg-white px-4 py-3 text-sm shadow-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {inv.customer_name ?? "Client"} · {inv.invoice_number ?? "Sans n°"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {inv.invoice_date ?? "—"} · {formatEur(inv.amount_ttc)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending || !paConnected}
                  onClick={() => handleEmit(inv.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  title={paConnected ? undefined : "Connectez la PA d'abord"}
                >
                  <Send className="h-3.5 w-3.5" />
                  Émettre PA
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Historique</h2>
        {emitted.length === 0 ? (
          <p className="text-sm italic text-gray-400">Aucune facture émise.</p>
        ) : (
          <ul className="space-y-2">
            {emitted.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {inv.customer_name ?? "Client"}
                    {inv.invoice_number ? ` · N° ${inv.invoice_number}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    {inv.invoice_date ?? "—"} · {formatEur(inv.amount_ttc)}
                    {inv.pa_lifecycle_status ? ` · ${inv.pa_lifecycle_status}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {STATUS_LABELS[inv.status] ?? inv.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
