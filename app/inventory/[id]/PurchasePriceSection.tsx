import type { PurchasePriceStats } from "@/lib/stock/purchasePriceHistory";
import { uiCard, uiCardMuted, uiMuted, uiTableHead, uiWarn } from "@/components/ui/premium";

function formatEur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function PurchasePriceSection({
  stockUnit,
  stats,
  error,
  referenceUnitCostHt,
}: {
  stockUnit: string;
  stats: PurchasePriceStats;
  error: string | null;
  /** Prix saisi sur la fiche composant (€ HT / unité de stock), si défini. */
  referenceUnitCostHt?: number | null;
}) {
  return (
    <div className={uiCard}>
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Prix d’achat</h2>
      <p className={`mb-3 ${uiMuted}`}>
        Les indicateurs ci-dessous viennent des mouvements d’achat avec coût unitaire (€ HT / {stockUnit}). Vous
        pouvez aussi renseigner un prix de référence dans « Modifier le composant » — il sert de repli à la
        réception lorsqu’aucune facture ni historique d’achat ne fournit de coût.
      </p>
      {error && <p className={`mb-2 ${uiWarn}`}>{error}</p>}
      <dl className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className={uiCardMuted}>
          <dt className={uiMuted}>Dernier prix connu</dt>
          <dd className="font-semibold text-slate-900">
            {stats.lastKnownUnitCost != null
              ? `${formatEur(stats.lastKnownUnitCost)} / ${stockUnit}`
              : "—"}
          </dd>
        </div>
        {referenceUnitCostHt != null && Number(referenceUnitCostHt) > 0 ? (
          <div className={uiCardMuted}>
            <dt className={uiMuted}>Prix de référence (fiche)</dt>
            <dd className="font-semibold text-slate-900">
              {formatEur(referenceUnitCostHt)} / {stockUnit}
            </dd>
          </div>
        ) : null}
        <div className={uiCardMuted}>
          <dt className={uiMuted}>Moyenne 3 mois (glissant)</dt>
          <dd className="font-semibold text-slate-900">
            {stats.avgThreeMonthsWeighted != null
              ? `${formatEur(stats.avgThreeMonthsWeighted)} / ${stockUnit}`
              : "— (pas assez de données)"}
          </dd>
        </div>
      </dl>
      <h3 className={`mb-2 ${uiMuted} font-semibold uppercase tracking-wide`}>
        Évolution par mois (3 derniers mois calendaires)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={uiTableHead}>
              <th className="rounded-tl-xl pb-2 pl-2 pr-3 pt-2">Mois</th>
              <th className="pb-2 pr-3 pt-2 text-right">Qté achetée</th>
              <th className="rounded-tr-xl pb-2 pr-2 pt-2 text-right">Prix moy. pondéré</th>
            </tr>
          </thead>
          <tbody>
            {stats.monthlyBuckets.map((b) => (
              <tr key={b.yearMonth} className="border-b border-slate-50">
                <td className="py-2 pr-3 capitalize text-slate-800">{b.labelFr}</td>
                <td className="py-2 pr-3 text-right text-slate-600">
                  {b.movementCount === 0 ? "—" : `${b.totalQty} ${stockUnit}`}
                </td>
                <td className="py-2 text-right text-slate-800">
                  {b.weightedAvgUnitCost != null ? formatEur(b.weightedAvgUnitCost) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
