"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SupplierInvoiceAnalysisLine } from "@/lib/supplier-invoice-analysis";
import { updateSupplierInvoiceExtractedLinesAction } from "./actions";

type EditableLine = {
  clientId: string;
  label: string;
  quantity: string;
  unit: string;
  unit_price: string;
  line_total: string;
};

type Props = {
  invoiceId: string;
  restaurantId: string;
  initialLines: SupplierInvoiceAnalysisLine[];
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `invoice_line_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toInputValue(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "" : String(value);
}

function parseMoneyOrQty(value: string): number | null {
  const s = value.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function makeRow(line?: SupplierInvoiceAnalysisLine): EditableLine {
  return {
    clientId: newClientId(),
    label: line?.label ?? "",
    quantity: toInputValue(line?.quantity ?? null),
    unit: line?.unit ?? "",
    unit_price: toInputValue(line?.unit_price ?? null),
    line_total: toInputValue(line?.line_total ?? null),
  };
}

export function InvoiceExtractedLinesEditor({ invoiceId, restaurantId, initialLines }: Props) {
  const router = useRouter();
  const initialRows = useMemo(
    () => (initialLines.length > 0 ? initialLines.map(makeRow) : [makeRow()]),
    [initialLines]
  );
  const [rows, setRows] = useState<EditableLine[]>(initialRows);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<EditableLine>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? [makeRow()] : prev.filter((_, i) => i !== index)));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function save() {
    setError(null);
    setSuccess(null);
    const payload = rows
      .map((row) => ({
        label: row.label.trim(),
        quantity: parseMoneyOrQty(row.quantity),
        unit: row.unit.trim() || null,
        unit_price: parseMoneyOrQty(row.unit_price),
        line_total: parseMoneyOrQty(row.line_total),
      }))
      .filter((row) => row.label.length > 0);

    if (payload.length === 0) {
      setError("Ajoutez au moins une ligne avec un libellé.");
      return;
    }

    startTransition(() => {
      updateSupplierInvoiceExtractedLinesAction(invoiceId, restaurantId, payload).then((res) => {
        if (!res.success) {
          setError(res.error);
          return;
        }
        setSuccess("Lignes facture corrigées. Le rapprochement est recalculé.");
        router.refresh();
      });
    });
  }

  return (
    <details className="mt-4 rounded border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-800">
        Corriger les lignes lues sur la facture
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        Modifiez les libellés, quantités, unités ou prix si la lecture IA est mauvaise. Le tableau d’écarts sera
        recalculé après enregistrement.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500">
              <th className="pb-1 pr-2">Libellé</th>
              <th className="pb-1 pr-2">Qté</th>
              <th className="pb-1 pr-2">Unité</th>
              <th className="pb-1 pr-2">Prix unit.</th>
              <th className="pb-1 pr-2">Total ligne</th>
              <th className="pb-1 pr-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.clientId}>
                <td className="py-1 pr-2">
                  <input
                    value={row.label}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Libellé produit"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    value={row.quantity}
                    onChange={(e) => updateRow(index, { quantity: e.target.value })}
                    inputMode="decimal"
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    value={row.unit}
                    onChange={(e) => updateRow(index, { unit: e.target.value })}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="kg"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    value={row.unit_price}
                    onChange={(e) => updateRow(index, { unit_price: e.target.value })}
                    inputMode="decimal"
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    value={row.line_total}
                    onChange={(e) => updateRow(index, { line_total: e.target.value })}
                    inputMode="decimal"
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                </td>
                <td className="py-1 pr-2">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-xs font-medium text-rose-700 underline decoration-rose-300"
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? (
        <p className="mt-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={pending}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          Ajouter une ligne
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : "Enregistrer les corrections"}
        </button>
      </div>
    </details>
  );
}
