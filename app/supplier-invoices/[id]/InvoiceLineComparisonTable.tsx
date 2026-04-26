import type { InvoiceLineComparison } from "@/lib/invoice-reconciliation";

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

export function InvoiceLineComparisonTable({ rows }: { rows: InvoiceLineComparison[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Aucune ligne comparable pour l’instant : lancez l’analyse facture et liez une réception.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="p-2">Statut</th>
            <th className="p-2">Facture</th>
            <th className="p-2">BL / produit</th>
            <th className="p-2 text-right">Qté facture</th>
            <th className="p-2 text-right">Qté BL</th>
            <th className="p-2 text-right">PU facture</th>
            <th className="p-2 text-right">PU BL</th>
            <th className="p-2 text-right">Écart total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-slate-100 align-top">
              <td className="p-2">
                <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[row.status]}`}>
                  {STATUS_LABELS[row.status]}
                </span>
              </td>
              <td className="max-w-[14rem] p-2 text-slate-800">{row.invoiceLabel ?? "—"}</td>
              <td className="max-w-[14rem] p-2">
                <p className="font-medium text-slate-800">{row.receptionItemName ?? row.receptionLabel ?? "—"}</p>
                {row.receptionItemName && row.receptionLabel && row.receptionItemName !== row.receptionLabel ? (
                  <p className="text-xs text-slate-500">{row.receptionLabel}</p>
                ) : null}
                {row.hints.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
                    {row.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </td>
              <td className="p-2 text-right tabular-nums text-slate-700">{qty(row.invoiceQuantity)}</td>
              <td className="p-2 text-right tabular-nums text-slate-700">{qty(row.receptionQuantityPurchase)}</td>
              <td className="p-2 text-right tabular-nums text-slate-700">{eur(row.invoiceUnitPrice)}</td>
              <td className="p-2 text-right tabular-nums text-slate-700">{eur(row.receptionUnitPricePurchase)}</td>
              <td
                className={`p-2 text-right tabular-nums ${
                  row.lineTotalDelta != null && Math.abs(row.lineTotalDelta) > 0.05
                    ? "font-semibold text-rose-700"
                    : "text-slate-700"
                }`}
              >
                {row.lineTotalDelta != null && row.lineTotalDelta > 0 ? "+" : ""}
                {eur(row.lineTotalDelta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
