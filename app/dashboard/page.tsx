import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowUpRight, CalendarDays, Layers, Package, UtensilsCrossed } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getServicesForRestaurant, getServiceSalesAggregate, getInventoryItemsWithCalculatedStock } from "@/lib/db";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatServiceTypeLong(type: string) {
  return type === "lunch" ? "Déjeuner" : type === "dinner" ? "Dîner" : type === "both" ? "Les deux" : type;
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  iconClass = "bg-indigo-50 text-indigo-600",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  iconClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [{ data: recentServices }, { data: inventoryItems }] = await Promise.all([
    getServicesForRestaurant(restaurant.id, 10),
    getInventoryItemsWithCalculatedStock(restaurant.id),
  ]);

  const serviceIds = (recentServices ?? []).map((s) => s.id);
  const { data: aggregates } = await getServiceSalesAggregate(serviceIds);

  let totalSalesRecent = 0;
  let totalLinesRecent = 0;
  if (aggregates) {
    for (const a of aggregates.values()) {
      totalSalesRecent += a.totalQty;
      totalLinesRecent += a.lines;
    }
  }

  const belowMinStock = (inventoryItems ?? []).filter(
    (i) =>
      i.min_stock_qty != null &&
      (i.stock_qty_from_movements ?? i.current_stock_qty ?? 0) < i.min_stock_qty
  );
  const lastFiveServices = (recentServices ?? []).slice(0, 5);
  const inventoryCount = inventoryItems?.length ?? 0;

  const cardBase = "rounded-2xl border border-slate-100 bg-white shadow-sm";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{restaurant.name}</span>
          <span className="text-slate-400"> · </span>
          activité récente
        </p>
      </header>

      {/* Stats */}
      <section aria-label="Indicateurs récents">
        <h2 className="sr-only">Statistiques</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Services (échantillon)"
            value={recentServices?.length ?? 0}
            hint="10 derniers chargés"
            icon={CalendarDays}
          />
          <StatTile
            label="Quantités vendues"
            value={totalSalesRecent}
            hint="Sur ces services"
            icon={UtensilsCrossed}
          />
          <StatTile
            label="Lignes de ticket"
            value={totalLinesRecent}
            hint="Lignes de vente comptées"
            icon={Layers}
          />
          <StatTile
            label="Références stock"
            value={inventoryCount}
            hint="Composants suivis"
            icon={Package}
          />
        </div>
      </section>

      {belowMinStock.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <span className="font-semibold">{belowMinStock.length} composant(s) sous le seuil.</span>
          <Link
            href="/inventory"
            className="ml-auto inline-flex items-center gap-1 font-semibold text-amber-950 underline decoration-amber-400 underline-offset-2 hover:text-amber-800"
          >
            Voir le stock
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : null}

      {/* Derniers services — tableau */}
      {lastFiveServices.length > 0 ? (
        <section className={cardBase} aria-labelledby="services-heading">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
            <div>
              <h2 id="services-heading" className="text-sm font-semibold text-slate-900">
                Derniers services
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Accès rapide aux tickets récents</p>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Tout l’historique
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 sm:px-6">Date</th>
                  <th className="px-4 py-3 sm:px-6">Service</th>
                  <th className="px-4 py-3 text-right sm:px-6">Qté vendue</th>
                  <th className="px-4 py-3 text-right sm:px-6">Lignes</th>
                  <th className="w-12 px-4 py-3 sm:px-6" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lastFiveServices.map((s) => {
                  const agg = aggregates?.get(s.id) ?? { lines: 0, totalQty: 0 };
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900 sm:px-6">
                        {formatDate(s.service_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 sm:px-6">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {formatServiceTypeLong(s.service_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800 sm:px-6">
                        {agg.totalQty}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500 sm:px-6">
                        {agg.lines}
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <Link
                          href={`/service/${s.id}`}
                          className="inline-flex rounded-lg p-1.5 text-indigo-600 transition hover:bg-indigo-50"
                          aria-label={`Ouvrir le service du ${formatDate(s.service_date)}`}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
