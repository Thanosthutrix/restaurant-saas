"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  LayoutGrid,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type {
  CategoryAggregate,
  SalesInsightRow,
  SalesInsightSuggestions,
} from "@/lib/insights/salesInsights";

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")} %`;
}

type SortKey = "qty" | "revenue" | "marginPct" | "name";

export function SalesInsightsClient({
  rows,
  suggestions,
  categoryAggregates,
}: {
  rows: SalesInsightRow[];
  suggestions: SalesInsightSuggestions;
  categoryAggregates: CategoryAggregate[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");

  const categories = useMemo(() => {
    const set = new Set(rows.map((r) => r.categoryPath));
    return ["__all__", ...[...set].sort((a, b) => a.localeCompare(b, "fr"))];
  }, [rows]);

  const filtered = useMemo(() => {
    let list =
      categoryFilter === "__all__"
        ? [...rows]
        : rows.filter((r) => r.categoryPath === categoryFilter);
    list.sort((a, b) => {
      switch (sortKey) {
        case "qty":
          return b.qtySold - a.qtySold;
        case "revenue":
          return (b.revenueHt ?? 0) - (a.revenueHt ?? 0);
        case "marginPct":
          return (b.marginPct ?? -999) - (a.marginPct ?? -999);
        case "name":
          return a.dishName.localeCompare(b.dishName, "fr");
        default:
          return 0;
      }
    });
    return list;
  }, [rows, categoryFilter, sortKey]);

  const maxRev =
    categoryAggregates.reduce((m, c) => Math.max(m, c.revenueHt), 0) || 1;
  const topPlats = useMemo(() => {
    return [...rows].sort((a, b) => (b.revenueHt ?? 0) - (a.revenueHt ?? 0)).slice(0, 10);
  }, [rows]);
  const maxPlatRev =
    topPlats.reduce((m, r) => Math.max(m, r.revenueHt ?? 0), 0) || 1;

  return (
    <div className="space-y-10">
      {/* Rubriques — CA */}
      {categoryAggregates.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">CA par rubrique</h2>
              <p className="text-sm text-slate-600">
                Répartition du chiffre d&apos;affaires HT sur la période (services importés).
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoryAggregates.slice(0, 9).map((c) => (
              <button
                key={c.categoryPath}
                type="button"
                onClick={() => setCategoryFilter(c.categoryPath)}
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40 ${
                  categoryFilter === c.categoryPath
                    ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-100"
                    : "border-slate-100 bg-white"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rubrique
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                  {c.categoryPath}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                  {formatEur(c.revenueHt)}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${Math.max(8, (c.revenueHt / maxRev) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {c.qtySold} unités · marge cumulée {formatEur(c.marginHtSum || null)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Top 10 visuel */}
      {topPlats.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Top 10 — CA par plat</h2>
          <div className="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            {topPlats.map((r, i) => (
              <div key={r.dishId} className="flex items-center gap-3 text-sm">
                <span className="w-6 shrink-0 tabular-nums text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-900">{r.dishName}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-800">
                      {formatEur(r.revenueHt)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500/90"
                      style={{
                        width: `${Math.max(
                          6,
                          ((r.revenueHt ?? 0) / maxPlatRev) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggestions */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Suggestions</h2>
        <p className="text-sm text-slate-600">
          Indicateurs automatiques à partir des ventes et des marges réalisées (FIFO). À adapter à votre
          politique commerciale.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <SuggestionCard
            title="À mettre en avant"
            subtitle="Forte marge + volume"
            icon={TrendingUp}
            accent="border-emerald-200 bg-emerald-50/50"
            rows={suggestions.pushHard}
          />
          <SuggestionCard
            title="À revoir (prix ou coût)"
            subtitle="Marge faible avec volume"
            icon={TrendingDown}
            accent="border-rose-200 bg-rose-50/40"
            rows={suggestions.reviewPricing}
          />
          <SuggestionCard
            title="Recettes à compléter"
            subtitle="Ventes sans recette validée"
            icon={Wrench}
            accent="border-amber-200 bg-amber-50/50"
            rows={suggestions.fixRecipe}
          />
          <SuggestionCard
            title="Opportunités promo"
            subtitle="Bonne marge, peu vendu — pousser la carte"
            icon={Sparkles}
            accent="border-violet-200 bg-violet-50/40"
            rows={suggestions.sleeperHits}
          />
        </div>
      </section>

      {/* Table tri / filtre */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Détail par plat</h2>
            <p className="text-sm text-slate-600">
              Triez et filtrez par rubrique. Les marges suivent la même logique que l&apos;écran{" "}
              <Link href="/margins" className="font-medium text-indigo-600 underline underline-offset-2">
                Marges
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1">
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                Rubrique
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "__all__" ? "Toutes les rubriques" : c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1">
                <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden />
                Trier par
              </span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              >
                <option value="revenue">CA HT décroissant</option>
                <option value="qty">Quantités vendues</option>
                <option value="marginPct">Marge %</option>
                <option value="name">Nom (A → Z)</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Plat</th>
                  <th className="px-4 py-3 font-medium">Rubrique</th>
                  <th className="px-4 py-3 text-right font-medium">Qté</th>
                  <th className="px-4 py-3 text-right font-medium">CA HT</th>
                  <th className="px-4 py-3 text-right font-medium">Marge %</th>
                  <th className="px-4 py-3 text-right font-medium">Marge HT</th>
                  <th className="px-4 py-3 font-medium">Recette</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.dishId} className="align-top hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dishes/${r.dishId}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {r.dishName}
                      </Link>
                      {r.note ? (
                        <p className="mt-0.5 text-xs text-amber-800/90">{r.note}</p>
                      ) : null}
                    </td>
                    <td className="max-w-[14rem] px-4 py-3 text-slate-700">
                      <span className="line-clamp-2">{r.categoryPath}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {r.qtySold}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                      {formatEur(r.revenueHt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          r.marginPct != null && r.marginPct >= 65
                            ? "font-semibold text-emerald-700"
                            : r.marginPct != null && r.marginPct < 50
                              ? "font-semibold text-rose-700"
                              : "text-slate-800"
                        }
                      >
                        {formatPct(r.marginPct)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatEur(r.marginHt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.recipeStatus === "validated"
                        ? "Validée"
                        : r.recipeStatus === "draft"
                          ? "Brouillon"
                          : r.recipeStatus === "missing"
                            ? "Manquante"
                            : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Aucun plat dans cette sélection.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function SuggestionCard({
  title,
  subtitle,
  icon: Icon,
  accent,
  rows,
}: {
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  accent: string;
  rows: SalesInsightRow[];
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${accent}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-slate-800 shadow-sm">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-600">{subtitle}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Rien à signaler avec les seuils actuels.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li
              key={r.dishId}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm"
            >
              <Link
                href={`/dishes/${r.dishId}`}
                className="min-w-0 flex-1 truncate font-medium text-indigo-800 hover:underline"
              >
                {r.dishName}
              </Link>
              <span className="shrink-0 tabular-nums text-xs text-slate-600">
                {r.qtySold} u. · {formatEur(r.revenueHt)} · {formatPct(r.marginPct)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
