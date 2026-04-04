import Link from "next/link";
import type { DishFoodCostResult } from "@/lib/margins/dishMarginAnalysis";
import { uiCard, uiMuted, uiWarn } from "@/components/ui/premium";

function formatEur(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function RecipeFoodCostSection({
  title,
  footnote,
  result,
}: {
  title: string;
  footnote?: string;
  result: DishFoodCostResult;
}) {
  if (result.errorMessage) {
    return (
      <div className={uiCard}>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Coût matière de la recette</h2>
        <p className={uiWarn}>{result.errorMessage}</p>
      </div>
    );
  }

  return (
    <div className={uiCard}>
      <h2 className="mb-1 text-sm font-semibold text-slate-900">{title}</h2>
      {footnote ? <p className={`mb-3 ${uiMuted}`}>{footnote}</p> : null}
      {!result.costIsComplete ? (
        <p className={`mb-3 ${uiWarn}`}>
          Coût partiel : renseignez un prix d&apos;achat (réception, historique) ou le prix de référence sur la fiche de
          chaque composant encore à « — ».
        </p>
      ) : null}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
        <span className="text-sm font-medium text-slate-700">Total matière HT</span>
        <span className="text-lg font-semibold tabular-nums text-slate-900">
          {result.costIsComplete
            ? formatEur(result.foodCostHt)
            : `≥ ${formatEur(result.foodCostHt)} (partiel)`}
        </span>
      </div>
      {result.breakdown.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Composant</th>
                <th className="py-2 pr-2">Qté</th>
                <th className="py-2 pr-2">Coût unit. HT</th>
                <th className="py-2">Ligne HT</th>
              </tr>
            </thead>
            <tbody>
              {result.breakdown.map((row) => (
                <tr key={row.inventoryItemId} className="border-b border-slate-50">
                  <td className="py-2 pr-2 font-medium text-slate-900">{row.name}</td>
                  <td className="py-2 pr-2 tabular-nums text-slate-700">
                    {row.qty} {row.unit}
                  </td>
                  <td className="py-2 pr-2 tabular-nums text-slate-700">
                    {row.unitCostHt != null ? formatEur(row.unitCostHt) : "—"}
                  </td>
                  <td className="py-2 tabular-nums text-slate-900">
                    {row.lineCostHt != null ? formatEur(row.lineCostHt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={uiMuted}>Aucune ligne après dépliage.</p>
      )}
      <p className={`mt-3 ${uiMuted}`}>
        <Link href="/margins" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Vue Marges
        </Link>
        {" · "}
        même logique (dernier achat connu, sinon prix de référence fiche composant).
      </p>
    </div>
  );
}
