import type { SupplierInvoiceAnalysisView } from "@/lib/supplier-invoice-analysis";

type Props = {
  analysisView: SupplierInvoiceAnalysisView | null;
  analysis_status: string | null;
  analysis_error: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  done: "Terminée",
  error: "Échec",
  skipped: "Non exécutée (configuration)",
  unsupported_pdf: "PDF non analysé automatiquement",
};

function fmt(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString("fr-FR") : "—";
  return String(v);
}

function isSoftNoticeStatus(status: string | null): boolean {
  return status === "unsupported_pdf" || status === "skipped";
}

export function InvoiceAnalysisSection({ analysisView, analysis_status, analysis_error }: Props) {
  const hasPayload = analysisView != null;
  const statusHuman = analysis_status ? (STATUS_LABELS[analysis_status] ?? analysis_status) : null;

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <h2 className="mb-2 text-sm font-medium text-slate-700">
        Résultat de l’analyse
      </h2>

      {analysis_error && isSoftNoticeStatus(analysis_status) && (
        <p
          className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          {analysis_error}
        </p>
      )}

      {analysis_error && !isSoftNoticeStatus(analysis_status) && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          Erreur d’analyse : {analysis_error}
        </p>
      )}

      {statusHuman && (
        <p className="mb-2 text-xs text-slate-500">
          Statut : {statusHuman}
        </p>
      )}

      {!hasPayload && !analysis_error && !analysis_status && (
        <p className="text-sm text-slate-600">
          Aucune analyse enregistrée pour cette facture. Elle est lancée automatiquement après l’upload (fichiers image). Vous pouvez aussi utiliser « Relancer l’analyse ».
        </p>
      )}

      {hasPayload && (
        <>
          <dl className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">N° facture extrait</dt>
              <dd className="font-medium text-slate-900">{fmt(analysisView!.invoice_number)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Date extraite</dt>
              <dd className="font-medium text-slate-900">{fmt(analysisView!.invoice_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Montant HT extrait</dt>
              <dd className="font-medium text-slate-900">
                {analysisView!.amount_ht != null ? `${fmt(analysisView!.amount_ht)} €` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Montant TTC extrait</dt>
              <dd className="font-medium text-slate-900">
                {analysisView!.amount_ttc != null ? `${fmt(analysisView!.amount_ttc)} €` : "—"}
              </dd>
            </div>
          </dl>

          {analysisView!.vendor &&
          Object.values(analysisView!.vendor).some((x) => x != null && String(x).trim() !== "") ? (
            <div className="mb-4 rounded border border-slate-200 bg-white px-3 py-2 text-sm">
              <p className="mb-1 text-xs font-medium text-slate-600">Émetteur détecté sur la facture</p>
              <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                {analysisView!.vendor.legal_name ? (
                  <div>
                    <dt className="text-slate-500">Raison sociale</dt>
                    <dd className="text-slate-900">{fmt(analysisView!.vendor.legal_name)}</dd>
                  </div>
                ) : null}
                {analysisView!.vendor.siret ? (
                  <div>
                    <dt className="text-slate-500">SIRET</dt>
                    <dd className="text-slate-900">{fmt(analysisView!.vendor.siret)}</dd>
                  </div>
                ) : null}
                {analysisView!.vendor.vat_number ? (
                  <div>
                    <dt className="text-slate-500">N° TVA</dt>
                    <dd className="text-slate-900">{fmt(analysisView!.vendor.vat_number)}</dd>
                  </div>
                ) : null}
                {analysisView!.vendor.email ? (
                  <div>
                    <dt className="text-slate-500">E-mail</dt>
                    <dd className="text-slate-900">{fmt(analysisView!.vendor.email)}</dd>
                  </div>
                ) : null}
                {analysisView!.vendor.phone ? (
                  <div>
                    <dt className="text-slate-500">Téléphone</dt>
                    <dd className="text-slate-900">{fmt(analysisView!.vendor.phone)}</dd>
                  </div>
                ) : null}
                {analysisView!.vendor.address ? (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Adresse</dt>
                    <dd className="text-slate-900">{fmt(analysisView!.vendor.address)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-2 text-[11px] text-slate-500">
                Ces champs servent à compléter la fiche fournisseur lorsque les zones correspondantes sont encore vides.
              </p>
            </div>
          ) : null}

          <p className="mb-2 text-xs text-slate-500">
            Les totaux ligne sont attendus en <strong className="font-medium text-slate-600">HT</strong> pour correspondre au montant HT facture dans le rapprochement.
          </p>
          <h3 className="mb-2 text-xs font-medium text-slate-600">
            Lignes extraites
          </h3>
          {analysisView!.lines.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune ligne structurée dans le résultat d’analyse.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-2 py-2 font-medium text-slate-700">Libellé</th>
                    <th className="px-2 py-2 font-medium text-slate-700">Qté</th>
                    <th className="px-2 py-2 font-medium text-slate-700">Unité</th>
                    <th className="px-2 py-2 font-medium text-slate-700">Prix unit.</th>
                    <th className="px-2 py-2 font-medium text-slate-700">Total ligne (HT)</th>
                  </tr>
                </thead>
                <tbody>
                  {analysisView!.lines.map((line, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-2 py-2 text-slate-900">{line.label}</td>
                      <td className="px-2 py-2 text-slate-700">{fmt(line.quantity)}</td>
                      <td className="px-2 py-2 text-slate-700">{fmt(line.unit)}</td>
                      <td className="px-2 py-2 text-slate-700">
                        {line.unit_price != null ? `${fmt(line.unit_price)} €` : "—"}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {line.line_total != null ? `${fmt(line.line_total)} €` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {analysisView!.raw_text && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-600 underline">
                Texte brut (aperçu)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800">
                {analysisView!.raw_text}
              </pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}
