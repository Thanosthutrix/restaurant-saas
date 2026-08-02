"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  LayoutGrid,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import {
  applyAnalysisRecommendationAction,
  dismissAnalysisRecommendationAction,
  generateUltimateAnalysisReportAction,
} from "@/app/analysis/actions";
import { QUADRANT_LABELS } from "@/lib/analysis/analysisReportBuilder";
import type { MenuMatrixQuadrant, UltimateAnalysisReport } from "@/lib/analysis/reportTypes";
import {
  uiBtnPrimary,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiInput,
  uiLabel,
  uiLead,
  uiMuted,
  uiSuccess,
} from "@/components/ui/premium";

const QUADRANT_STYLES: Record<MenuMatrixQuadrant, string> = {
  star: "bg-emerald-100 text-emerald-800",
  plowhorse: "bg-amber-100 text-amber-900",
  puzzle: "bg-sky-100 text-sky-800",
  dog: "bg-stone-200 text-stone-700",
};

function fmtEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")} %`;
}

type Props = {
  restaurantId: string;
  initialReport: UltimateAnalysisReport | null;
  defaultFrom: string;
  defaultTo: string;
};

export function UltimateAnalysisDashboard({
  restaurantId,
  initialReport,
  defaultFrom,
  defaultTo,
}: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setReport(initialReport);
  }, [initialReport]);

  const generate = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await generateUltimateAnalysisReportAction({ restaurantId, from, to });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess("Rapport généré.");
      router.refresh();
    });
  };

  const applyRec = (recommendationId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await applyAnalysisRecommendationAction({ restaurantId, recommendationId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(
        res.data?.newQty != null
          ? `Fiche technique mise à jour (nouvelle qté : ${res.data.newQty}).`
          : "Recommandation marquée comme appliquée."
      );
      router.refresh();
    });
  };

  const dismissRec = (recommendationId: string) => {
    startTransition(async () => {
      await dismissAnalysisRecommendationAction({ restaurantId, recommendationId });
      router.refresh();
    });
  };

  const d = report?.deterministic;
  const coach = report?.coach;

  return (
    <div className="space-y-8">
      <section className={uiCard}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={uiLabel} htmlFor="analyse-from">
              Du
            </label>
            <input
              id="analyse-from"
              type="date"
              className={uiInput + " mt-1"}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className={uiLabel} htmlFor="analyse-to">
              Au
            </label>
            <input
              id="analyse-to"
              type="date"
              className={uiInput + " mt-1"}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button type="button" className={uiBtnPrimary} onClick={generate} disabled={pending}>
            {pending ? "Analyse en cours…" : "Générer le rapport"}
          </button>
        </div>
        <p className={uiLead + " mt-3"}>
          Calculs financiers stricts + synthèse coach IA à partir des ventes, pertes et micro-sondages anonymes.
        </p>
      </section>

      {error ? <p className={uiError}>{error}</p> : null}
      {success ? <p className={uiSuccess}>{success}</p> : null}

      {!report || !d ? (
        <p className={uiLead}>Aucun rapport pour l&apos;instant. Choisissez une période et lancez l&apos;analyse.</p>
      ) : (
        <>
          {/* KPIs */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="CA HT" value={fmtEur(d.totals.revenueHt)} />
            <KpiCard label="Marge HT" value={fmtEur(d.totals.marginHt)} sub={fmtPct(d.totals.marginPct)} />
            <KpiCard label="Pertes" value={fmtEur(d.totals.wasteCostHt)} sub={`${d.waste.logCount} saisies`} />
            <KpiCard
              label="Food cost réel"
              value={fmtPct(d.foodCostGap.realizedFoodCostPct)}
              sub={
                d.foodCostGap.gapPctPoints != null
                  ? `Δ théo ${d.foodCostGap.gapPctPoints >= 0 ? "+" : ""}${d.foodCostGap.gapPctPoints} pts`
                  : undefined
              }
            />
          </section>

          {/* Coach IA */}
          {coach ? (
            <section className="rounded-2xl border border-copper-200/70 bg-gradient-to-br from-copper-50/80 to-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-copper-700" aria-hidden />
                <h2 className="text-lg font-semibold text-stone-900">Synthèse coach</h2>
                <span className={uiMuted}>· {coach.model}</span>
              </div>
              <p className="text-sm leading-relaxed text-stone-700">{coach.summary}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {coach.insights.map((insight, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-stone-200/70 bg-white/90 p-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-stone-900">{insight.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">{insight.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Matrice menu */}
          <section className={uiCard}>
            <div className="mb-4 flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-stone-500" aria-hidden />
              <h2 className="text-lg font-semibold text-stone-900">Matrice du menu</h2>
            </div>
            <p className={uiLead + " mb-4"}>
              Seuils : {d.matrixThresholds.medianQty} ventes · marge médiane {fmtPct(d.matrixThresholds.medianMarginPct)}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <th className="py-2 pr-3">Plat</th>
                    <th className="py-2 pr-3 text-right">Ventes</th>
                    <th className="py-2 pr-3 text-right">CA HT</th>
                    <th className="py-2 pr-3 text-right">Marge</th>
                    <th className="py-2">Quadrant</th>
                  </tr>
                </thead>
                <tbody>
                  {d.menuMatrix.slice(0, 20).map((m) => (
                    <tr key={m.dishId} className="border-b border-stone-50">
                      <td className="py-2.5 pr-3 font-medium text-stone-800">
                        <Link href={`/dishes/${m.dishId}`} className="hover:text-copper-700">
                          {m.dishName}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{m.qtySold}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{fmtEur(m.revenueHt)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{fmtPct(m.marginPct)}</td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ${QUADRANT_STYLES[m.quadrant]}`}
                        >
                          {QUADRANT_LABELS[m.quadrant]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Terrain + pertes */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={uiCard}>
              <h2 className="mb-3 text-sm font-semibold text-stone-900">Ressenti terrain (anonyme)</h2>
              <ul className="space-y-2 text-sm text-stone-600">
                <li>{d.feedback.totalResponses} réponses sur la période</li>
                <li>
                  Stress : 🔴 {d.feedback.stressDistribution.hell} · 🟡 {d.feedback.stressDistribution.tense} · 🟢{" "}
                  {d.feedback.stressDistribution.smooth}
                </li>
                <li>{d.feedback.plateReturns} signalements retours assiettes</li>
                <li>{d.feedback.ingredientQualityAlerts} alertes qualité ingrédient</li>
              </ul>
            </section>
            <section className={uiCard}>
              <h2 className="mb-3 text-sm font-semibold text-stone-900">Pertes</h2>
              <p className="text-2xl font-semibold tabular-nums text-stone-900">{fmtEur(d.waste.totalCostHt)}</p>
              <p className={uiMuted}>{d.waste.logCount} entrées</p>
              {d.waste.topItems.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-stone-600">
                  {d.waste.topItems.map((w) => (
                    <li key={w.name}>
                      {w.name} — {fmtEur(w.costHt)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>

          {/* Recommandations */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-stone-900">Recommandations</h2>
            {report.recommendations.length === 0 ? (
              <p className={uiLead}>Aucune recommandation pour ce rapport.</p>
            ) : (
              report.recommendations.map((rec) => (
                <article
                  key={rec.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    rec.status === "applied"
                      ? "border-emerald-200 bg-emerald-50/40"
                      : rec.status === "dismissed"
                        ? "border-stone-100 bg-stone-50 opacity-60"
                        : "border-stone-200/70 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {rec.recommendation_type === "menu_pricing" ? (
                          <TrendingUp className="h-4 w-4 text-amber-600" aria-hidden />
                        ) : rec.recommendation_type.includes("reduce") ? (
                          <TrendingDown className="h-4 w-4 text-rose-600" aria-hidden />
                        ) : rec.recommendation_type === "operational" ? (
                          <Wrench className="h-4 w-4 text-stone-500" aria-hidden />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-stone-400" aria-hidden />
                        )}
                        <h3 className="text-sm font-semibold text-stone-900">{rec.title}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-stone-600">{rec.body}</p>
                      {rec.dish_id ? (
                        <Link
                          href={`/dishes/${rec.dish_id}`}
                          className="mt-2 inline-block text-xs font-semibold text-copper-700 hover:underline"
                        >
                          Voir la fiche plat →
                        </Link>
                      ) : null}
                    </div>
                    {rec.status === "pending" ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {(rec.recommendation_type === "reduce_component_qty" ||
                          rec.recommendation_type === "increase_component_qty") &&
                        rec.dish_id &&
                        rec.inventory_item_id ? (
                          <button
                            type="button"
                            className={uiBtnPrimary}
                            disabled={pending}
                            onClick={() => applyRec(rec.id)}
                          >
                            Appliquer à la fiche technique
                          </button>
                        ) : rec.dish_id ? (
                          <Link href={`/dishes/${rec.dish_id}`} className={uiBtnSecondary}>
                            Ouvrir la recette
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={uiBtnSecondary}
                            disabled={pending}
                            onClick={() => applyRec(rec.id)}
                          >
                            <Check className="mr-1 inline h-4 w-4" aria-hidden />
                            Marquer fait
                          </button>
                        )}
                        <button
                          type="button"
                          className={uiBtnSecondary}
                          disabled={pending}
                          onClick={() => dismissRec(rec.id)}
                          aria-label="Ignorer"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-stone-500">
                        {rec.status === "applied" ? "Appliquée" : "Ignorée"}
                      </span>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
      <p className={uiLabel}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-stone-900">{value}</p>
      {sub ? <p className={uiMuted}>{sub}</p> : null}
    </div>
  );
}
