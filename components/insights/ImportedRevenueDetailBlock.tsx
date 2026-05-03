import { parseAnalysisResultJson } from "@/lib/revenue-statement-analysis";

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

type Props = {
  analysisJson: unknown;
  /** Classes pour le conteneur externe (carte, padding). */
  className?: string;
};

/**
 * Détail extrait d’un relevé CA (lignes plats/rubriques, couverts, notes document).
 * À partir de `analysis_result_json` en base.
 */
export function ImportedRevenueDetailBlock({ analysisJson, className = "" }: Props) {
  const p = parseAnalysisResultJson(analysisJson);
  const hasMeta =
    p.covers_estimate != null ||
    p.ticket_count_estimate != null ||
    (p.document_notes != null && p.document_notes.length > 0);

  if (p.lines.length === 0 && !hasMeta) return null;

  return (
    <div
      className={`rounded-xl border border-slate-100 bg-slate-50/80 ${className}`.trim()}
    >
      {(hasMeta || p.lines.length > 0) && (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Données extraites du relevé (photo / OCR)
        </p>
      )}
      {(p.covers_estimate != null || p.ticket_count_estimate != null) && (
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-700">
          {p.covers_estimate != null ? (
            <span>
              <strong className="font-semibold text-slate-900">Couverts (est.)</strong> :{" "}
              {p.covers_estimate.toLocaleString("fr-FR")}
            </span>
          ) : null}
          {p.ticket_count_estimate != null ? (
            <span>
              <strong className="font-semibold text-slate-900">Tickets / commandes (est.)</strong> :{" "}
              {p.ticket_count_estimate.toLocaleString("fr-FR")}
            </span>
          ) : null}
        </div>
      )}
      {p.document_notes ? (
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          <span className="font-medium text-slate-800">Document : </span>
          {p.document_notes}
        </p>
      ) : null}
      {p.lines.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 font-medium">Libellé</th>
                <th className="px-2 py-2 font-medium">Rubrique</th>
                <th className="px-2 py-2 text-right font-medium">Qté</th>
                <th className="px-2 py-2 text-right font-medium">TTC</th>
                <th className="px-2 py-2 text-right font-medium">HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {p.lines.map((line, idx) => (
                <tr key={`${line.label}-${idx}`} className="text-slate-800">
                  <td className="max-w-[14rem] px-2 py-1.5 font-medium">{line.label}</td>
                  <td className="max-w-[10rem] px-2 py-1.5 text-slate-600">
                    {line.category ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                    {line.qty != null ? line.qty.toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatEur(line.amount_ttc)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatEur(line.amount_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {p.lines.length === 0 && hasMeta && (
        <p className="text-xs text-slate-500">
          Aucune ligne détaillée (plats / rubriques) détectée sur ce scan — seuls des totaux ou métadonnées
          étaient lisibles.
        </p>
      )}
    </div>
  );
}
