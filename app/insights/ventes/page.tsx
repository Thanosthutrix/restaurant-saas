import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getRestaurantMonthlyRevenues } from "@/lib/db";
import { getSalesInsightsData } from "@/lib/insights/salesInsights";
import {
  defaultMarginDateRange,
  parseMarginDateParam,
} from "@/lib/margins/realizedServiceMargins";
import { ImportedMonthlyCaSection } from "./ImportedMonthlyCaSection";
import { SalesInsightsClient } from "./SalesInsightsClient";
import { uiBackLink, uiBtnSecondary, uiCard, uiInput, uiLabel, uiLead, uiPageTitle } from "@/components/ui/premium";

type SearchParams = { from?: string; to?: string };

export default async function VentesInsightsPage({
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

  const [{ rows, suggestions, categoryAggregates, meta, error }, monthlyImportRes] = await Promise.all([
    getSalesInsightsData(restaurant.id, from, to),
    getRestaurantMonthlyRevenues(restaurant.id),
  ]);
  const monthlyImported = monthlyImportRes.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard" className={uiBackLink}>
            ← Tableau de bord
          </Link>
          <h1 className={`mt-3 ${uiPageTitle}`}>Analyse des ventes</h1>
          <p className={`mt-1 ${uiLead}`}>{restaurant.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/insights/revenue"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            CA importé (historique)
          </Link>
          <Link
            href="/margins"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            Marges détaillées
          </Link>
          <Link
            href="/insights/calendar"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            Calendrier
          </Link>
        </div>
      </div>

      <div className={uiCard}>
        <p className="text-sm leading-relaxed text-slate-600">
          Deux niveaux : (1) le <strong className="font-medium text-slate-800">CA mensuel</strong> issu de vos
          relevés importés (photos, avant ou pendant l&apos;adoption de l&apos;outil) — voir la section dédiée
          ci‑dessous ; (2) l&apos;analyse <strong className="font-medium text-slate-800">par plat</strong> à partir
          des services enregistrés dans l&apos;app (tickets / analyse), avec quantités, rubriques et{" "}
          <strong className="font-medium text-slate-800">marges réalisées</strong> (même logique que la page
          Marges : valorisation HT, coût FIFO ventilé).
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3 text-sm" method="get" action="/insights/ventes">
          <label className="flex flex-col gap-0.5">
            <span className={uiLabel}>Du</span>
            <input type="date" name="from" defaultValue={from} className={uiInput} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={uiLabel}>Au</span>
            <input type="date" name="to" defaultValue={to} className={uiInput} />
          </label>
          <button type="submit" className={uiBtnSecondary}>
            Appliquer
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Période :{" "}
          <strong className="font-medium text-slate-700">
            {from} → {to}
          </strong>
          · jusqu&apos;à {meta.serviceCount} services récents inclus dans la fenêtre (ordonnés du plus récent).
        </p>
      </div>

      {monthlyImportRes.error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Impossible de charger le CA importé : {monthlyImportRes.error.message}
        </div>
      )}

      {!monthlyImportRes.error && (
        <ImportedMonthlyCaSection rows={monthlyImported} rangeFrom={from} rangeTo={to} />
      )}

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Avertissement chargement : {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className={uiCard}>
          <p className="text-sm text-slate-700">
            Aucune vente détaillée par plat sur cette période : les graphiques et tableaux ci‑dessous restent
            vides tant que vous n&apos;avez pas enregistré de services avec lignes rattachées à des plats. Le CA
            mensuel importé (section ci‑dessus) peut toutefois documenter les mois passés, même sans ce détail.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-slate-900">
            Détail par plat (services enregistrés dans l&apos;app)
          </h2>
          <p className="-mt-2 text-sm text-slate-600">
            Une fois le restaurant pilote avec des tickets analysés, cette partie enrichit le CA importé avec des{" "}
            <strong className="font-medium text-slate-800">rubriques</strong>,{" "}
            <strong className="font-medium text-slate-800">quantités</strong> et{" "}
            <strong className="font-medium text-slate-800">marges</strong> par ligne.
          </p>
          <SalesInsightsClient
            rows={rows}
            suggestions={suggestions}
            categoryAggregates={categoryAggregates}
          />
        </>
      )}
    </div>
  );
}
