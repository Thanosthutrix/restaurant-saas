"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { RestaurantMonthlyRevenue } from "@/lib/db";
import type { CategoryAggregate } from "@/lib/insights/salesInsights";
import {
  buildExtractedDetailAggregates,
  buildExtractedRootAggregates,
  buildExtractedTopByLabel,
  hasExtractedLineAmounts,
  hasImportedRevenueDetail,
  parseAnalysisResultJson,
} from "@/lib/revenue-statement-analysisJson";
import { ImportedRevenueDetailBlock } from "@/components/insights/ImportedRevenueDetailBlock";
import { loadMonthSalesInsightsAction } from "./monthInsightsActions";
import type { MonthSalesInsightsForClient } from "@/lib/insights/salesInsights";
import { uiCard } from "@/components/ui/premium";
import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatMonthShort(isoMonth: string) {
  return new Date(isoMonth + "T12:00:00.000Z").toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
}

function formatMonthLong(isoMonth: string) {
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

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function rowMonthInRange(monthFirstDay: string, from: string, to: string): boolean {
  const mk = monthKey(monthFirstDay);
  const fk = monthKey(from);
  const tk = monthKey(to);
  return mk >= fk && mk <= tk;
}

function priorYearSameMonth(isoMonth: string): string {
  const ym = monthKey(isoMonth);
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  return `${y - 1}-${String(m).padStart(2, "0")}`;
}

function yoyLabel(
  current: RestaurantMonthlyRevenue,
  byMonth: Map<string, RestaurantMonthlyRevenue>
): { text: string; tone: "up" | "down" | "flat" | "none" } {
  const cur = primaryAmount(current);
  const prevRow = byMonth.get(priorYearSameMonth(current.month));
  const prev = prevRow ? primaryAmount(prevRow) : null;
  if (cur == null || prev == null || prev <= 0) return { text: "N-1 : —", tone: "none" };
  const pct = ((cur - prev) / prev) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  if (Math.abs(rounded) < 0.05)
    return { text: `vs ${formatMonthShort(priorYearSameMonth(current.month))} : ≈ stable`, tone: "flat" };
  return {
    text: `vs ${formatMonthShort(priorYearSameMonth(current.month))} : ${sign}${rounded.toLocaleString("fr-FR")} %`,
    tone: rounded > 0 ? "up" : "down",
  };
}

function CaMarginBarRow({
  label,
  revenueHt,
  marginHtSum,
  maxRevenue,
  secondary,
}: {
  label: string;
  revenueHt: number;
  marginHtSum: number;
  maxRevenue: number;
  secondary?: string;
}) {
  const rev = revenueHt > 0 ? revenueHt : 0;
  const rawMar = Number.isFinite(marginHtSum) ? marginHtSum : 0;
  const marForBar = Math.max(0, Math.min(rev, rawMar));
  const barOuterPct = maxRevenue > 0 ? Math.max(8, (rev / maxRevenue) * 100) : 8;
  const marginRatio = rev > 0 ? Math.min(1, marForBar / rev) : 0;
  const marginPct = rev > 0 ? (rawMar / rev) * 100 : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2 text-xs">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{label}</p>
          {secondary ? <p className="truncate text-[10px] text-slate-500">{secondary}</p> : null}
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <p className="font-semibold text-slate-800">{formatEur(rev)}</p>
          <p className="text-[10px] text-emerald-700">Marge {formatEur(rawMar)}</p>
        </div>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100/90 ring-1 ring-slate-200/60">
        <div
          className="flex h-full overflow-hidden rounded-full shadow-inner"
          style={{ width: `${barOuterPct}%` }}
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all"
            style={{ width: `${marginRatio * 100}%` }}
            title="Marge HT"
          />
          <div
            className="h-full bg-gradient-to-r from-slate-200 to-slate-300/90"
            style={{ width: `${(1 - marginRatio) * 100}%` }}
            title="Coût matière (CA HT − marge)"
          />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Marge
        </span>
        <span>
          {marginPct != null ? `${marginPct.toFixed(1).replace(".", ",")} % du CA ligne` : "—"}
        </span>
        <span className="flex items-center gap-1">
          Coût
          <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
        </span>
      </div>
    </div>
  );
}

function CaMarginSection({
  title,
  hint,
  items,
  labelOf,
  sublabelOf,
}: {
  title: string;
  hint: string;
  items: CategoryAggregate[];
  labelOf: (c: CategoryAggregate) => string;
  sublabelOf?: (c: CategoryAggregate) => string | undefined;
}) {
  const maxRev = useMemo(() => Math.max(...items.map((c) => c.revenueHt), 1), [items]);
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-700">Aucune donnée agrégée</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold tracking-tight text-slate-900">{title}</h4>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-inner">
        {items.map((c, idx) => (
          <CaMarginBarRow
            key={`${labelOf(c)}-${idx}`}
            label={labelOf(c)}
            secondary={sublabelOf?.(c)}
            revenueHt={c.revenueHt}
            marginHtSum={c.marginHtSum}
            maxRevenue={maxRev}
          />
        ))}
      </div>
    </div>
  );
}

function CaExtractedBarRow({
  label,
  secondary,
  amount,
  maxAmount,
  qty,
}: {
  label: string;
  secondary?: string;
  amount: number;
  maxAmount: number;
  qty: number;
}) {
  const barPct = maxAmount > 0 ? Math.max(8, (amount / maxAmount) * 100) : 8;
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2 text-xs">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{label}</p>
          {secondary ? <p className="truncate text-[10px] text-slate-500">{secondary}</p> : null}
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <p className="font-semibold text-slate-800">{formatEur(amount)}</p>
          {qty > 0 ? (
            <p className="text-[10px] text-violet-700">{qty.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} unité(s)</p>
          ) : null}
        </div>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100/90 ring-1 ring-violet-200/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 shadow-inner transition-all"
          style={{ width: `${barPct}%` }}
          title="Part du CA relevé (ligne)"
        />
      </div>
    </div>
  );
}

function CaExtractedSection({
  title,
  hint,
  items,
}: {
  title: string;
  hint: string;
  items: { key: string; revenue: number; qty: number }[];
}) {
  const maxRev = useMemo(() => Math.max(...items.map((c) => c.revenue), 1), [items]);
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-200/80 bg-violet-50/40 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-700">Aucune ligne chiffrée</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold tracking-tight text-slate-900">{title}</h4>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-violet-100 bg-gradient-to-b from-white to-violet-50/40 p-4 shadow-inner">
        {items.map((c, idx) => (
          <CaExtractedBarRow
            key={`${c.key}-${idx}`}
            label={c.key}
            amount={c.revenue}
            maxAmount={maxRev}
            qty={c.qty}
          />
        ))}
      </div>
    </div>
  );
}

export function MonthlyImportedCaBoard({
  rows,
  rangeFrom,
  rangeTo,
}: {
  rows: RestaurantMonthlyRevenue[];
  rangeFrom: string;
  rangeTo: string;
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.month.localeCompare(a.month)), [rows]);
  const byMonth = useMemo(() => new Map(sorted.map((r) => [monthKey(r.month), r])), [sorted]);
  const maxImported = useMemo(
    () => sorted.reduce((m, r) => Math.max(m, primaryAmount(r) ?? 0), 0) || 1,
    [sorted]
  );

  const [expanded, setExpanded] = useState<string | null>(null);
  const [cache, setCache] = useState<Map<string, MonthSalesInsightsForClient>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadMonth = useCallback((isoMonth: string) => {
    setLoadError(null);
    setLoadingMonth(isoMonth);
    startTransition(() => {
      void (async () => {
        const res = await loadMonthSalesInsightsAction(isoMonth);
        setLoadingMonth(null);
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        setCache((prev) => new Map(prev).set(isoMonth, res.data));
      })();
    });
  }, []);

  const toggle = (monthRaw: string) => {
    const mk = monthKey(monthRaw);
    if (expanded === mk) {
      setExpanded(null);
      return;
    }
    setExpanded(mk);
    setLoadError(null);
    if (!cache.has(mk)) loadMonth(mk);
  };

  const inRangeCount = sorted.filter((r) => rowMonthInRange(r.month, rangeFrom, rangeTo)).length;

  if (sorted.length === 0) {
    return (
      <section className="space-y-4">
        <div className={uiCard}>
          <h2 className="text-lg font-semibold text-slate-900">CA importé (relevés)</h2>
          <p className="mt-2 text-sm text-slate-600">
            Aucun mois enregistré. Importez des relevés depuis l&apos;intégration ou{" "}
            <Link href="/insights/revenue" className="font-medium text-indigo-600 underline">
              CA importé
            </Link>
            .
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className={uiCard}>
        <h2 className="text-lg font-semibold text-slate-900">CA mensuel importé</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Chaque tuile reprend le <strong className="font-medium text-slate-800">montant du relevé</strong> et
          l&apos;<strong className="font-medium text-slate-800">évolution vs le même mois N-1</strong> lorsque
          l&apos;historique existe. Cliquez pour déployer :{" "}
          <strong className="font-medium text-slate-800">marge réalisée</strong> sur le mois (services saisis dans
          l&apos;app) et graphiques <strong className="font-medium text-slate-800">CA vs marge</strong> par grande
          rubrique puis par plat.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {inRangeCount > 0
            ? `${inRangeCount} mois dans la période filtrée (${rangeFrom} → ${rangeTo}) sur ${sorted.length} mois en base.`
            : `Aucun mois importé dans la plage filtrée ; toutes les tuiles restent visibles.`}{" "}
          <Link href="/insights/revenue" className="font-medium text-indigo-600 underline underline-offset-2">
            Tableau détaillé CA
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {sorted.map((r) => {
          const mk = monthKey(r.month);
          const amt = primaryAmount(r);
          const inRange = rowMonthInRange(r.month, rangeFrom, rangeTo);
          const yoy = yoyLabel(r, byMonth);
          const barPct = amt != null ? Math.max(10, (amt / maxImported) * 100) : 10;
          const isOpen = expanded === mk;
          const insight = cache.get(mk);

          return (
            <div
              key={r.id}
              className={`overflow-hidden rounded-3xl border shadow-lg transition-all duration-300 ${
                isOpen
                  ? "border-indigo-200/90 bg-white ring-2 ring-indigo-100/80 xl:col-span-2 2xl:col-span-2"
                  : "border-slate-200/80 bg-white hover:border-indigo-200 hover:shadow-xl"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(r.month)}
                className="flex w-full flex-col items-stretch gap-3 p-5 text-left"
                aria-expanded={isOpen}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500/90">Mois</p>
                    <p className="mt-1 text-lg font-bold capitalize tracking-tight text-slate-900">
                      {formatMonthLong(r.month)}
                    </p>
                    {inRange ? (
                      <span className="mt-2 inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-800">
                        Période analyse
                      </span>
                    ) : (
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        Hors filtre
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>

                <div>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                    {formatEur(r.revenue_ttc ?? null)}
                    <span className="ml-2 text-sm font-semibold text-slate-400">TTC</span>
                  </p>
                  {r.revenue_ht != null ? (
                    <p className="mt-1 text-sm tabular-nums text-slate-600">
                      {formatEur(r.revenue_ht)} HT <span className="text-slate-400">(relevé)</span>
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {yoy.tone === "up" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {yoy.text}
                    </span>
                  ) : yoy.tone === "down" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-900 ring-1 ring-rose-100">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {yoy.text}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">{yoy.text}</span>
                  )}
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${
                      inRange ? "from-indigo-500 via-violet-500 to-fuchsia-500" : "from-slate-400 to-slate-500"
                    }`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-5 border-t border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 pb-6 pt-4">
                    {loadingMonth === mk && !insight ? (
                      <p className="text-sm text-slate-500">Chargement des ventes du mois…</p>
                    ) : null}
                    {loadError && expanded === mk && !insight ? (
                      <p className="text-sm text-rose-700">{loadError}</p>
                    ) : null}
                    {insight ? (
                      <>
                        {insight.error ? (
                          <p className="text-sm text-amber-800">{insight.error}</p>
                        ) : null}
                        {(() => {
                          const extracted = parseAnalysisResultJson(r.analysis_result_json);
                          const lines = extracted.lines;
                          const showExtractedCharts =
                            lines.length > 0 && hasExtractedLineAmounts(lines);
                          const extractedRoots = showExtractedCharts
                            ? buildExtractedRootAggregates(lines)
                            : [];
                          const extractedDetails = showExtractedCharts
                            ? buildExtractedDetailAggregates(lines).slice(0, 12)
                            : [];
                          const extractedTopLabels = showExtractedCharts
                            ? buildExtractedTopByLabel(lines, 24)
                            : [];
                          const showAppCharts = insight.totals.serviceCount > 0;

                          return (
                            <>
                              <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-4 text-white shadow-md">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                                    Marge mois
                                  </p>
                                  <p className="mt-2 text-3xl font-bold tabular-nums">
                                    {insight.totals.marginPct != null
                                      ? `${insight.totals.marginPct.toFixed(1).replace(".", ",")} %`
                                      : "—"}
                                  </p>
                                  <p className="mt-1 text-sm text-white/90">
                                    {formatEur(insight.totals.marginHt)} HT sur{" "}
                                    {formatEur(insight.totals.revenueHt)} CA HT (app)
                                  </p>
                                  <p className="mt-3 text-[10px] text-white/70">
                                    {insight.totals.serviceCount} service(s) · {insight.dishCountWithSales}{" "}
                                    plat(s) vendu(s)
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:col-span-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Lecture
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {showAppCharts && showExtractedCharts ? (
                                      <>
                                        Graphiques <strong className="text-slate-800">bleu / vert (app)</strong> : tickets
                                        et marges FIFO. Graphiques{" "}
                                        <strong className="text-violet-900">rose / violet (relevé)</strong> : montants
                                        lus sur le document (HT si présent, sinon TTC par ligne). La tuile affiche le total
                                        relevé importé.
                                      </>
                                    ) : null}
                                    {showAppCharts && !showExtractedCharts ? (
                                      <>
                                        Les graphiques utilisent les{" "}
                                        <strong className="text-slate-800">tickets enregistrés</strong> (CA HT, marge
                                        FIFO). Le montant en tête de tuile reste le{" "}
                                        <strong className="text-slate-800">relevé importé</strong>
                                        {lines.length > 0
                                          ? " — aucun montant par ligne exploitable sur l’extraction pour des barres."
                                          : "."}
                                      </>
                                    ) : null}
                                    {!showAppCharts && showExtractedCharts ? (
                                      <>
                                        Uniquement des données{" "}
                                        <strong className="text-violet-900">extraites du relevé</strong> (aucun service
                                        app sur ce mois). Barres proportionnelles aux montants lus (HT si indiqué, sinon
                                        TTC).
                                      </>
                                    ) : null}
                                    {!showAppCharts && !showExtractedCharts ? (
                                      <>
                                        Pas de services app sur ce mois et pas de lignes chiffrées dans l&apos;extraction :
                                        aucune répartition en barres.
                                      </>
                                    ) : null}
                                  </p>
                                </div>
                              </div>

                              {showExtractedCharts ? (
                                <div className="rounded-2xl border border-violet-200/90 bg-violet-50/30 px-4 py-4 shadow-sm">
                                  <p className="text-xs font-bold uppercase tracking-wide text-violet-900">
                                    Répartition selon le relevé importé
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    Données issues de l&apos;extraction automatique du scan — sans marge matière
                                    (non calculée à partir du relevé).
                                  </p>
                                  <div className="mt-5 grid gap-8 lg:grid-cols-2">
                                    <CaExtractedSection
                                      title="Grandes rubriques (relevé)"
                                      hint="Premier niveau de la rubrique extraite du document."
                                      items={extractedRoots}
                                    />
                                    <CaExtractedSection
                                      title="Rubrique ou libellé (relevé)"
                                      hint="Rubrique complète si présente, sinon libellé de ligne (12 plus forts en montant)."
                                      items={extractedDetails}
                                    />
                                  </div>
                                  {extractedTopLabels.length > 0 ? (
                                    <div className="mt-8">
                                      <CaExtractedSection
                                        title="Lignes du relevé (top montants)"
                                        hint="Libellés tels que sur le document, triés par montant cumulé."
                                        items={extractedTopLabels}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              {showAppCharts ? (
                                <div className="grid gap-8 lg:grid-cols-2">
                                  <CaMarginSection
                                    title="Grandes rubriques (app)"
                                    hint="Premier niveau de l’arborescence carte — part du CA HT et marge cumulée."
                                    items={insight.rootCategoryAggregates}
                                    labelOf={(c) => c.categoryPath}
                                  />
                                  <CaMarginSection
                                    title="Rubrique détaillée (app)"
                                    hint="Chemin complet sur la carte (12 plus fortes en CA)."
                                    items={insight.categoryAggregates.slice(0, 12)}
                                    labelOf={(c) => c.categoryPath}
                                  />
                                </div>
                              ) : null}

                              {!showAppCharts && !showExtractedCharts ? (
                                <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                                  Aucun service enregistré dans l&apos;app pour ce mois, et aucune ligne chiffrée
                                  exploitable dans le relevé importé : pas de graphiques de répartition.
                                </div>
                              ) : null}

                              {showAppCharts && insight.topDishRows.length > 0 ? (
                                <CaMarginSection
                                  title="Plats (top ventes du mois, app)"
                                  hint="Les plats les plus vendus en CA HT sur le mois — marge par ligne."
                                  items={insight.topDishRows.map((row) => ({
                                    categoryPath: row.dishName,
                                    qtySold: row.qtySold,
                                    revenueHt: row.revenueHt ?? 0,
                                    marginHtSum: row.marginHt ?? 0,
                                  }))}
                                  labelOf={(c) => c.categoryPath}
                                  sublabelOf={(c) => {
                                    const row = insight.topDishRows.find((x) => x.dishName === c.categoryPath);
                                    return row ? `${row.qtySold} vendu(s) · ${row.categoryPath}` : undefined;
                                  }}
                                />
                              ) : null}

                              {hasImportedRevenueDetail(r.analysis_result_json) ? (
                                <div>
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Détail extrait du relevé (document)
                                  </p>
                                  <ImportedRevenueDetailBlock
                                    analysisJson={r.analysis_result_json}
                                    className="rounded-2xl border border-slate-100 bg-white p-3"
                                  />
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
