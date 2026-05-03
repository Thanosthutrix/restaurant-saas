import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  getRestaurantMonthlyRevenues,
  type RestaurantMonthlyRevenue,
} from "@/lib/db";
import { hasImportedRevenueDetail } from "@/lib/revenue-statement-analysis";
import { ImportedRevenueDetailBlock } from "@/components/insights/ImportedRevenueDetailBlock";
import { uiBackLink, uiCard, uiLead, uiPageTitle } from "@/components/ui/premium";

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatMonthFr(isoMonth: string) {
  return new Date(isoMonth + "T12:00:00.000Z").toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function primaryAmount(r: RestaurantMonthlyRevenue): number | null {
  if (r.revenue_ttc != null && Number.isFinite(r.revenue_ttc)) return r.revenue_ttc;
  if (r.revenue_ht != null && Number.isFinite(r.revenue_ht)) return r.revenue_ht;
  return null;
}

function momEvolutionLabel(
  current: RestaurantMonthlyRevenue,
  prev: RestaurantMonthlyRevenue | undefined
): string | null {
  if (!prev) return null;
  const c = primaryAmount(current);
  const p = primaryAmount(prev);
  if (c == null || p == null || p === 0) return null;
  const pct = ((c - p) / p) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)} % vs mois préc.`;
}

export default async function InsightsRevenuePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: rows, error } = await getRestaurantMonthlyRevenues(restaurant.id);
  const asc = [...(rows ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  const prevById = new Map<string, RestaurantMonthlyRevenue | undefined>();
  for (let i = 0; i < asc.length; i++) {
    prevById.set(asc[i].id, i > 0 ? asc[i - 1] : undefined);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className={uiBackLink}>
            ← Tableau de bord
          </Link>
          <h1 className={`mt-3 ${uiPageTitle}`}>CA mensuel importé</h1>
          <p className={`mt-1 ${uiLead}`}>{restaurant.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/margins"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            Marges réalisées
          </Link>
          <Link
            href="/insights/calendar"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            Calendrier pilotage
          </Link>
        </div>
      </div>

      <div className={uiCard}>
        <p className="text-sm leading-relaxed text-slate-600">
          Les montants ci-dessous proviennent des{" "}
          <strong className="font-medium text-slate-800">documents de CA</strong> importés pendant
          l&apos;onboarding (lecture assistée). Ils sont enregistrés en base par mois et servent de{" "}
          <strong className="font-medium text-slate-800">référence historique</strong> pour analyser la
          dynamique et, plus tard, la croiser avec vos marges et objectifs.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Lorsque le document photo contient un <strong className="font-medium text-slate-800">détail par plat</strong>
          , rubrique ou ligne de vente, l&apos;IA tente de l&apos;extraire : voir le bloc &quot;Données extraites du
          relevé&quot; sous chaque mois. Ce n&apos;est pas rattaché à votre carte actuelle (pas de matching automatique
          des plats) — c&apos;est une lecture du document.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Pour croiser avec l&apos;analyse par plat et les marges issues des services enregistrés dans l&apos;app, ouvrez{" "}
          <Link
            href="/insights/ventes"
            className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            Analyse des ventes
          </Link>
          : le CA importé y apparaît aussi en tête de page.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Impossible de charger l&apos;historique : {error.message}
        </div>
      )}

      {!error && (!rows || rows.length === 0) && (
        <div className={uiCard}>
          <p className="text-sm text-slate-700">
            Aucun CA mensuel enregistré pour l&apos;instant. Importez des relevés depuis le parcours
            d&apos;intégration (étape documents de chiffre d&apos;affaires) pour alimenter cet écran.
          </p>
        </div>
      )}

      {!error && rows && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 sm:hidden">
            Faites défiler horizontalement pour voir toutes les colonnes.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Mois</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">CA TTC</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">CA HT</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Évolution</th>
                  <th className="min-w-[8rem] px-4 py-3 font-medium">Source</th>
                  <th className="min-w-[12rem] px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const prev = prevById.get(r.id);
                  const evo = momEvolutionLabel(r, prev);
                  const showExtract = hasImportedRevenueDetail(r.analysis_result_json);
                  return (
                    <Fragment key={r.id}>
                      <tr className="align-top transition-colors hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-4 py-3 font-medium capitalize text-slate-900">
                          {formatMonthFr(r.month)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">
                          {formatEur(r.revenue_ttc)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">
                          {formatEur(r.revenue_ht)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {evo ? (
                            <span
                              className={
                                evo.startsWith("+")
                                  ? "font-medium text-emerald-700"
                                  : evo.startsWith("-")
                                    ? "font-medium text-rose-700"
                                    : "text-slate-600"
                              }
                            >
                              {evo}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="max-w-[14rem] px-4 py-3 text-slate-700">
                          {r.source_label?.trim() ? r.source_label : "—"}
                        </td>
                        <td className="max-w-[20rem] px-4 py-3 text-xs leading-relaxed text-slate-600">
                          {r.notes?.trim() ? r.notes : "—"}
                        </td>
                      </tr>
                      {showExtract ? (
                        <tr className="bg-slate-50/70">
                          <td colSpan={6} className="border-b border-slate-100 px-4 py-3 align-top">
                            <ImportedRevenueDetailBlock analysisJson={r.analysis_result_json} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        Variation mois à mois calculée sur le premier montant disponible (TTC, sinon HT) par rapport au mois
        calendaire précédent présent dans l&apos;historique. Pour un CA détaillé jour par jour à partir des
        services scannés, utilisez le{" "}
        <Link href="/insights/calendar" className="font-medium text-slate-700 underline underline-offset-2">
          pilotage calendrier
        </Link>
        . Les relevés importés avant l&apos;extraction enrichie peuvent n&apos;avoir que les totaux ; réimportez une
        image du même document pour tenter d&apos;enregistrer aussi les lignes détaillées.
      </p>
    </div>
  );
}
