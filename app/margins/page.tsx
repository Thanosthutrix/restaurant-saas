import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getMarginAnalysisRows } from "@/lib/margins/dishMarginAnalysis";
import { getRealizedMarginRowsByDish } from "@/lib/margins/realizedDishMargins";
import {
  defaultMarginDateRange,
  fetchServicesInDateRange,
  getRealizedMarginRowsForServices,
  parseMarginDateParam,
} from "@/lib/margins/realizedServiceMargins";
import { MarginsCustomRangeForm } from "./MarginsCustomRangeForm";
import { MarginsDateRangeLinks } from "./MarginsDateRangeLinks";
import { uiBackLink, uiCard, uiPageTitle, uiTableLink } from "@/components/ui/premium";

function formatEur(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatServiceType(t: string) {
  return t === "lunch" ? "Midi" : t === "dinner" ? "Soir" : t;
}

function formatServiceDate(iso: string) {
  return new Date(iso + "T12:00:00.000Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatVatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${String(v).replace(".", ",")} %`;
}

const STATUS_LABELS: Record<string, string> = {
  validated: "Validée",
  draft: "Brouillon",
  missing: "Sans recette",
};

type SearchParams = { from?: string; to?: string };

export default async function MarginsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const defaults = defaultMarginDateRange();
  let from = parseMarginDateParam(sp.from, defaults.from);
  let to = parseMarginDateParam(sp.to, defaults.to);
  if (from > to) {
    const x = from;
    from = to;
    to = x;
  }

  const [{ rows, error }, servicesInRange] = await Promise.all([
    getMarginAnalysisRows(restaurant.id),
    fetchServicesInDateRange(restaurant.id, from, to, 80),
  ]);
  const [realizedRows, dishMarginRows] = await Promise.all([
    getRealizedMarginRowsForServices(restaurant.id, servicesInRange),
    getRealizedMarginRowsByDish(
      restaurant.id,
      servicesInRange.map((s) => s.id)
    ),
  ]);

  const sorted = [...rows].sort((a, b) => {
    const pa = a.marginPct;
    const pb = b.marginPct;
    if (pa != null && pb != null && pb !== pa) return pb - pa;
    if (pa != null && pb == null) return -1;
    if (pa == null && pb != null) return 1;
    return a.dishName.localeCompare(b.dishName, "fr");
  });

  let sumRev = 0;
  let sumCost = 0;
  let sumMargin = 0;
  let sumRevForMargin = 0;
  for (const r of realizedRows) {
    if (r.revenueHt != null) sumRev += r.revenueHt;
    sumCost += r.fifoCostHt;
    if (r.marginHt != null && r.revenueHt != null) {
      sumMargin += r.marginHt;
      sumRevForMargin += r.revenueHt;
    }
  }
  const aggMarginPct = sumRevForMargin > 0 ? (sumMargin / sumRevForMargin) * 100 : null;

  let dSumRev = 0;
  let dSumFifo = 0;
  let dSumMargin = 0;
  let dRevForMargin = 0;
  for (const r of dishMarginRows) {
    if (r.revenueHt != null) dSumRev += r.revenueHt;
    dSumFifo += r.allocatedFifoCostHt;
    if (r.marginHt != null && r.revenueHt != null) {
      dSumMargin += r.marginHt;
      dRevForMargin += r.revenueHt;
    }
  }
  const dAggMarginPct = dRevForMargin > 0 ? (dSumMargin / dRevForMargin) * 100 : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
      </div>

      <div className={uiCard}>
        <h1 className={uiPageTitle}>Analyse des marges</h1>
        <p className="mt-2 text-sm text-slate-600">
          <strong className="font-medium text-slate-800">Carte</strong> : coût matière théorique (recette × coûts
          composants), prix TTC carte et TVA par plat ; le HT est déduit pour la marge.{" "}
          <strong className="font-medium text-slate-800">Services</strong> : CA selon montants ticket (colonne
          line_total_ht sur les ventes) ou, à défaut, qté vendue × prix carte ; coût matière = valorisation{" "}
          <strong>FIFO</strong> des sorties de stock liées au service.{" "}
          <strong className="font-medium text-slate-800">Par plat (réalisé)</strong> : même période — le FIFO de
          chaque service est ventilé sur les plats vendus (coût théorique portion, sinon CA ou quantité).
        </p>
        {error && <p className="mt-2 text-sm text-rose-600">{error.message}</p>}
      </div>

      <section className="mb-10">
          <h2 className="mb-2 text-lg font-medium text-slate-900">
            Marge réalisée par service
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Uniquement les services dans l’intervalle. La marge n’est affichée que si le CA est entièrement
            estimable et si toutes les sorties FIFO ont un coût unitaire connu.
          </p>
        <div className={uiCard}>
          <MarginsDateRangeLinks currentFrom={from} currentTo={to} />
          <MarginsCustomRangeForm from={from} to={to} />
        </div>

          {realizedRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Aucun service sur cette période.
            </p>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-3 py-2 font-medium">Service</th>
                      <th className="px-3 py-2 font-medium">CA HT</th>
                      <th className="px-3 py-2 text-right font-medium">Coût FIFO HT</th>
                      <th className="px-3 py-2 text-right font-medium">Marge HT</th>
                      <th className="px-3 py-2 text-right font-medium">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {realizedRows.map((r) => (
                      <tr key={r.serviceId} className="border-b border-slate-100">
                        <td className="px-3 py-2 align-top">
                          <Link
                            href={`/service/${r.serviceId}`}
                            className={uiTableLink}
                          >
                            {formatServiceDate(r.serviceDate)} — {formatServiceType(r.serviceType)}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">{r.revenueNote}</p>
                          {r.fifoHasUnknownCost && (
                            <p className="mt-1 text-xs text-amber-700">
                              Coût FIFO partiel : une partie des sorties n’a pas de coût lot (stock ancien ou
                              sans achat valorisé).
                            </p>
                          )}
                          {!r.revenueComplete && (
                            <p className="mt-1 text-xs text-amber-700">
                              Complétez les prix TTC (et TVA) sur les plats concernés.
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-800">
                          {r.revenueHt != null ? formatEur(r.revenueHt) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-slate-800">
                          {formatEur(r.fifoCostHt)}
                          {r.fifoHasUnknownCost ? " *" : ""}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-slate-800">
                          {r.marginHt != null ? formatEur(r.marginHt) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-slate-800">
                          {r.marginPct != null ? `${r.marginPct.toFixed(1)} %` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/80 font-medium">
                      <td className="px-3 py-2 text-slate-800">Total (période)</td>
                      <td className="px-3 py-2 text-slate-800">{formatEur(sumRev)}</td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {formatEur(sumCost)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {sumRevForMargin > 0 ? formatEur(sumMargin) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {aggMarginPct != null ? `${aggMarginPct.toFixed(1)} %` : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                * Coût FIFO minimal connu ; la marge n’est pas calculée tant qu’une fraction du coût est
                inconnue. Le total « Marge » et le taux global ne portent que sur les services où la marge a
                pu être calculée (CA complet et FIFO entièrement valorisé).
              </p>
            </>
          )}

          <h3 className="mb-2 mt-10 text-base font-medium text-slate-900">
            Marge réalisée par plat (même période)
          </h3>
          <p className="mb-3 text-sm text-slate-600">
            Agrégation des ventes sur l’intervalle. Le coût FIFO de chaque service est réparti entre les lignes
            du service au prorata du coût matière théorique d’une portion (recette × prix composants) ; si ce
            coût manque, au prorata du CA ligne ou de la quantité.
          </p>

          {servicesInRange.length === 0 || dishMarginRows.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucune vente sur des services dans cette période.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-3 py-2 font-medium">Plat</th>
                      <th className="px-3 py-2 text-right font-medium">CA HT</th>
                      <th className="px-3 py-2 text-right font-medium">Coût FIFO alloué</th>
                      <th className="px-3 py-2 text-right font-medium">Marge HT</th>
                      <th className="px-3 py-2 text-right font-medium">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dishMarginRows.map((r) => (
                      <tr key={r.dishId} className="border-b border-slate-100">
                        <td className="px-3 py-2 align-top">
                          <Link
                            href={`/dishes/${r.dishId}`}
                            className={uiTableLink}
                          >
                            {r.dishName}
                          </Link>
                          {r.note && (
                            <p className="mt-1 text-xs text-amber-700">{r.note}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-slate-800">
                          {r.revenueHt != null ? formatEur(r.revenueHt) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-slate-800">
                          {formatEur(r.allocatedFifoCostHt)}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-slate-800">
                          {r.marginHt != null ? formatEur(r.marginHt) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right align-top text-slate-800">
                          {r.marginPct != null ? `${r.marginPct.toFixed(1)} %` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/80 font-medium">
                      <td className="px-3 py-2 text-slate-800">Total (plats)</td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {formatEur(dSumRev)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {formatEur(dSumFifo)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {dRevForMargin > 0 ? formatEur(dSumMargin) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        {dAggMarginPct != null ? `${dAggMarginPct.toFixed(1)} %` : "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                La somme des « Coût FIFO alloué » par plat rejoint le total FIFO des services sur la période
                (à l’arrondi près). Les plats touchés par un FIFO partiel sans coût lot n’affichent pas de marge.
              </p>
            </>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-slate-900">
            Théorique à la carte (par plat)
          </h2>
          <p className="mb-3 text-sm text-slate-600">
            Indépendant des services : utile pour construire ou ajuster la carte.
          </p>

          {sorted.length === 0 && !error && (
            <p className="text-sm text-slate-600">Aucun plat pour ce restaurant.</p>
          )}

          {sorted.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-3 py-2 font-medium">Plat</th>
                    <th className="px-3 py-2 font-medium">Recette</th>
                    <th className="px-3 py-2 text-right font-medium">PV TTC</th>
                    <th className="px-3 py-2 text-right font-medium">TVA</th>
                    <th className="px-3 py-2 text-right font-medium">Coût mat. HT</th>
                    <th className="px-3 py-2 text-right font-medium">PV HT</th>
                    <th className="px-3 py-2 text-right font-medium">Marge HT</th>
                    <th className="px-3 py-2 text-right font-medium">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr
                      key={r.dishId}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-2 align-top">
                        <Link href={`/dishes/${r.dishId}`} className={uiTableLink}>
                          {r.dishName}
                        </Link>
                        {r.note && (
                          <p className="mt-1 text-xs text-amber-700">{r.note}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-600">
                        {r.recipeStatus ? STATUS_LABELS[r.recipeStatus] ?? r.recipeStatus : "—"}
                      </td>
                      <td className="px-3 py-2 text-right align-top text-slate-800">
                        {r.sellingPriceTtc != null ? formatEur(r.sellingPriceTtc) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right align-top text-slate-600">
                        {formatVatPct(r.sellingVatRatePct)}
                      </td>
                      <td className="px-3 py-2 text-right align-top text-slate-800">
                        {r.foodCostHt != null ? formatEur(r.foodCostHt) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right align-top text-slate-800">
                        {r.sellingPriceHt != null ? formatEur(r.sellingPriceHt) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right align-top text-slate-800">
                        {r.marginHt != null ? formatEur(r.marginHt) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right align-top text-slate-800">
                        {r.marginPct != null ? `${r.marginPct.toFixed(1)} %` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}
