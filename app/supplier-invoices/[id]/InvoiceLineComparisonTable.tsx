"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceLineComparison } from "@/lib/invoice-reconciliation";
import type { SupplierInvoiceAnalysisLine } from "@/lib/supplier-invoice-analysis";
import { updateSupplierInvoiceExtractedLinesAction } from "./actions";

const STATUS_LABELS: Record<InvoiceLineComparison["status"], string> = {
  ok: "OK",
  price_delta: "Écart prix",
  qty_delta: "Écart quantité",
  invoice_only: "Facture seule",
  reception_only: "BL seul",
};

const STATUS_CLASS: Record<InvoiceLineComparison["status"], string> = {
  ok: "bg-emerald-100 text-emerald-800",
  price_delta: "bg-amber-100 text-amber-900",
  qty_delta: "bg-rose-100 text-rose-800",
  invoice_only: "bg-orange-100 text-orange-900",
  reception_only: "bg-sky-100 text-sky-900",
};

function eur(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function qty(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function inputValue(n: number | null): string {
  return n == null || !Number.isFinite(n) ? "" : String(n);
}

function parseNumberInput(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const AMOUNT_TOLERANCE = 0.05;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Même règle que `lineTotalFromUnit` côté serveur : total explicite prioritaire, sinon qté × PU. */
function invoiceLineTotalFromEditable(line: EditableInvoiceLine): number | null {
  const explicit = parseNumberInput(line.line_total);
  const qty = parseNumberInput(line.quantity);
  const pu = parseNumberInput(line.unit_price);
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) return round2(explicit);
  if (
    qty != null &&
    pu != null &&
    Number.isFinite(qty) &&
    Number.isFinite(pu)
  ) {
    return round2(qty * pu);
  }
  return null;
}

/**
 * Aperçu local après correction manuelle : réutilise les montants BL de la ligne et recalcule écarts / statut.
 */
function previewRowAfterInvoiceEdit(
  row: InvoiceLineComparison,
  editable: EditableInvoiceLine
): {
  invoiceLineTotal: number | null;
  qtyDelta: number | null;
  unitPriceDelta: number | null;
  lineTotalDelta: number | null;
  status: InvoiceLineComparison["status"];
} {
  const invTotal = invoiceLineTotalFromEditable(editable);
  const qty = parseNumberInput(editable.quantity);
  const pu = parseNumberInput(editable.unit_price);

  if (row.status === "invoice_only") {
    return {
      invoiceLineTotal: invTotal,
      qtyDelta: row.qtyDelta,
      unitPriceDelta: row.unitPriceDelta,
      lineTotalDelta: row.lineTotalDelta,
      status: row.status,
    };
  }

  if (row.status === "reception_only") {
    return {
      invoiceLineTotal: invTotal,
      qtyDelta: row.qtyDelta,
      unitPriceDelta: row.unitPriceDelta,
      lineTotalDelta: row.lineTotalDelta,
      status: row.status,
    };
  }

  const recQty = row.receptionQuantityPurchase;
  const recTotal = row.receptionLineTotal;
  const qtyDelta =
    qty != null && recQty != null ? round2(qty - recQty) : null;

  let unitPriceDelta: number | null = null;
  if (
    pu != null &&
    row.receptionPriceSource === "bl" &&
    row.receptionUnitPricePurchase != null
  ) {
    unitPriceDelta = round2(pu - row.receptionUnitPricePurchase);
  }

  const lineTotalDelta =
    invTotal != null && recTotal != null ? round2(invTotal - recTotal) : null;

  let status: InvoiceLineComparison["status"] = "ok";
  const hasQtyIssue = qtyDelta != null && Math.abs(qtyDelta) > 0.0001;
  const hasPriceIssue =
    unitPriceDelta != null && Math.abs(unitPriceDelta) > AMOUNT_TOLERANCE;
  const hasTotalIssue =
    lineTotalDelta != null && Math.abs(lineTotalDelta) > AMOUNT_TOLERANCE;

  if (hasQtyIssue) status = "qty_delta";
  if (hasPriceIssue) {
    status = status === "qty_delta" ? "qty_delta" : "price_delta";
  }
  if (hasTotalIssue && status === "ok") status = "price_delta";

  return {
    invoiceLineTotal: invTotal,
    qtyDelta,
    unitPriceDelta,
    lineTotalDelta,
    status,
  };
}

type EditableInvoiceLine = {
  label: string;
  quantity: string;
  unit: string;
  unit_price: string;
  line_total: string;
};

type Props = {
  rows: InvoiceLineComparison[];
  invoiceId: string;
  restaurantId: string;
  invoiceLines: SupplierInvoiceAnalysisLine[];
};

export function InvoiceLineComparisonTable({ rows, invoiceId, restaurantId, invoiceLines }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editedLines, setEditedLines] = useState<EditableInvoiceLine[]>(() =>
    invoiceLines.map((line) => ({
      label: line.label,
      quantity: inputValue(line.quantity),
      unit: line.unit ?? "",
      unit_price: inputValue(line.unit_price),
      line_total: inputValue(line.line_total),
    }))
  );
  const editableIndexes = useMemo(
    () => [...new Set(rows.map((row) => row.invoiceLineIndex).filter((idx): idx is number => idx != null))],
    [rows]
  );

  function updateInvoiceLine(index: number, patch: Partial<EditableInvoiceLine>) {
    setEditedLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if ("quantity" in patch || "unit_price" in patch) {
          const q = parseNumberInput(next.quantity);
          const pu = parseNumberInput(next.unit_price);
          if (
            q != null &&
            pu != null &&
            Number.isFinite(q) &&
            Number.isFinite(pu)
          ) {
            next.line_total = String(round2(q * pu));
          }
        }
        return next;
      })
    );
    setSaved(false);
    setError(null);
  }

  function saveInvoiceCorrections() {
    const payload = editedLines
      .map((line) => ({
        label: line.label.trim(),
        quantity: parseNumberInput(line.quantity),
        unit: line.unit.trim() || null,
        unit_price: parseNumberInput(line.unit_price),
        line_total: parseNumberInput(line.line_total),
      }))
      .filter((line) => line.label.length > 0);
    if (payload.length === 0) {
      setError("Ajoutez au moins une ligne facture avec un libellé.");
      return;
    }
    startTransition(() => {
      updateSupplierInvoiceExtractedLinesAction(invoiceId, restaurantId, payload).then((res) => {
        if (!res.success) {
          setError(res.error);
          return;
        }
        setSaved(true);
        router.refresh();
      });
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Aucune ligne comparable pour l’instant : lancez l’analyse facture et liez une réception.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[58rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="p-2">Statut</th>
              <th className="p-2">Facture</th>
              <th className="p-2">BL / produit</th>
              <th className="p-2 text-right">Qté facture</th>
              <th className="p-2 text-right">Qté BL</th>
              <th className="p-2 text-right">PU facture</th>
              <th className="p-2 text-right">PU BL</th>
              <th className="p-2 text-right">Total facture</th>
              <th className="p-2 text-right">Total BL reçu</th>
              <th className="p-2 text-right">Écart ligne HT (fact. − BL)</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const editable = row.invoiceLineIndex != null ? editedLines[row.invoiceLineIndex] : null;
              const preview = editable ? previewRowAfterInvoiceEdit(row, editable) : null;
              const statusDisplay = preview?.status ?? row.status;
              const lineDeltaDisplay = preview?.lineTotalDelta ?? row.lineTotalDelta;
              return (
                <tr key={idx} className="border-b border-slate-100 align-top">
                  <td className="p-2">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[statusDisplay]}`}>
                      {STATUS_LABELS[statusDisplay]}
                    </span>
                  </td>
                  <td className="max-w-[14rem] p-2 text-slate-800">
                    {editable ? (
                      <input
                        value={editable.label}
                        onChange={(e) =>
                          updateInvoiceLine(row.invoiceLineIndex as number, { label: e.target.value })
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    ) : (
                      row.invoiceLabel ?? "—"
                    )}
                  </td>
                  <td className="max-w-[14rem] p-2">
                    <p className="font-medium text-slate-800">{row.receptionItemName ?? row.receptionLabel ?? "—"}</p>
                    {row.receptionItemName && row.receptionLabel && row.receptionItemName !== row.receptionLabel ? (
                      <p className="text-xs text-slate-500">{row.receptionLabel}</p>
                    ) : null}
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-700">
                    {editable ? (
                      <div className="flex justify-end gap-1">
                        <input
                          value={editable.quantity}
                          onChange={(e) =>
                            updateInvoiceLine(row.invoiceLineIndex as number, { quantity: e.target.value })
                          }
                          inputMode="decimal"
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-xs"
                        />
                        <input
                          value={editable.unit}
                          onChange={(e) =>
                            updateInvoiceLine(row.invoiceLineIndex as number, { unit: e.target.value })
                          }
                          className="w-14 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : (
                      <>
                        {qty(row.invoiceQuantity)}
                        {row.invoiceUnit ? <span className="ml-1 text-xs text-slate-500">{row.invoiceUnit}</span> : null}
                      </>
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-700">
                    {qty(row.receptionQuantityPurchase)}
                    {row.receptionPurchaseUnit ? (
                      <span className="ml-1 text-xs text-slate-500">{row.receptionPurchaseUnit}</span>
                    ) : null}
                    {row.receptionStockUnit && row.receptionStockUnit !== row.receptionPurchaseUnit ? (
                      <p className="text-xs text-amber-700">stock : {row.receptionStockUnit}</p>
                    ) : null}
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-700">
                    {editable ? (
                      <input
                        value={editable.unit_price}
                        onChange={(e) =>
                          updateInvoiceLine(row.invoiceLineIndex as number, { unit_price: e.target.value })
                        }
                        inputMode="decimal"
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs"
                      />
                    ) : (
                      eur(row.invoiceUnitPrice)
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-700">
                    {eur(row.receptionUnitPricePurchase)}
                    {row.receptionPriceSource === "invoice_fallback" ? (
                      <p className="text-xs text-slate-500">prix facture repris (BL sans tarif)</p>
                    ) : row.receptionPriceSource === "missing" ? (
                      <p className="text-xs text-amber-700">prix BL manquant</p>
                    ) : null}
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-700">
                    {editable ? (
                      <input
                        value={editable.line_total}
                        onChange={(e) =>
                          updateInvoiceLine(row.invoiceLineIndex as number, { line_total: e.target.value })
                        }
                        inputMode="decimal"
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs"
                      />
                    ) : (
                      eur(row.invoiceLineTotal)
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums text-slate-700">{eur(row.receptionLineTotal)}</td>
                  <td
                    className={`p-2 text-right tabular-nums ${
                      lineDeltaDisplay != null && Math.abs(lineDeltaDisplay) > 0.05
                        ? "font-semibold text-rose-700"
                        : "text-slate-700"
                    }`}
                  >
                    {lineDeltaDisplay != null && lineDeltaDisplay > 0 ? "+" : ""}
                    {eur(lineDeltaDisplay)}
                  </td>
                  <td className="p-2 text-xs">
                    {row.receptionDeliveryNoteId ? (
                      <Link
                        href={`/receiving/${row.receptionDeliveryNoteId}`}
                        className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2"
                      >
                        Modifier le BL
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editableIndexes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveInvoiceCorrections}
            disabled={pending}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Enregistrement…" : "Enregistrer les corrections facture"}
          </button>
          {saved ? <span className="text-sm text-emerald-700">Corrections enregistrées.</span> : null}
          {error ? <span className="text-sm text-rose-700">{error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
