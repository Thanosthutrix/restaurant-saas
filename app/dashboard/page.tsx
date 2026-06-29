import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Armchair,
  ArrowUpRight,
  CalendarDays,
  ChefHat,
  Droplets,
  Layers,
  Package,
  Truck,
  UtensilsCrossed,
  WandSparkles,
  Wallet,
} from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { getServicesForRestaurant, getServiceSalesAggregate, getInventoryStockDashboardSummary } from "@/lib/db";
import { DayClockShell } from "@/components/staff/DayClockShell";
import { getStaffMemberByUserAndRestaurant, listWorkShiftsInRange } from "@/lib/staff/staffDb";
import { addDays, mondayOfWeekContaining } from "@/lib/staff/weekUtils";
import { ALL_SHELL_NAV_KEYS, type ShellNavKey } from "@/lib/auth/appRoles";
import { cachedListTemperaturePoints } from "@/lib/cache";
import { loadDashboardHygieneTileData } from "@/lib/dashboard/hygieneTileData";
import { DashboardHygieneTile } from "@/components/dashboard/DashboardHygieneTile";
import { DashboardFocusBand, type FocusItem } from "@/components/dashboard/DashboardFocusBand";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

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
  iconClass = "bg-copper-50 text-copper-700",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  iconClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-stone-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

const quickActions: {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  navKey: ShellNavKey;
}[] = [
  {
    label: "Salle",
    href: "/salle",
    description: "Tickets ouverts et service en cours",
    icon: Armchair,
    navKey: "salle",
  },
  {
    label: "Caisse",
    href: "/caisse",
    description: "Encaissements et tickets réglés",
    icon: Wallet,
    navKey: "caisse",
  },
  {
    label: "Cuisine",
    href: "/cuisine",
    description: "Service, fiches plats, stock et hygiène",
    icon: ChefHat,
    navKey: "cuisine",
  },
  {
    label: "Achats & stock",
    href: "/achats",
    description: "Commandes, BL, factures fournisseurs",
    icon: Truck,
    navKey: "achats",
  },
  {
    label: "Registres",
    href: "/registres",
    description: "Historiques et justificatifs",
    icon: Archive,
    navKey: "registres",
  },
  {
    label: "Assistant IA",
    href: "/onboarding/imports",
    description: "Réimporter carte, recettes et rubriques",
    icon: WandSparkles,
    navKey: "ai_assistant",
  },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const monday = mondayOfWeekContaining(new Date());
  const weekEndExclusive = addDays(monday, 7);

  const [{ data: recentServices }, { data: stockSummary }, staffForClock, shiftsWeek, accessContext] = await Promise.all([
    getServicesForRestaurant(restaurant.id, 10),
    getInventoryStockDashboardSummary(restaurant.id),
    getStaffMemberByUserAndRestaurant(user.id, restaurant.id),
    listWorkShiftsInRange(restaurant.id, monday.toISOString(), weekEndExclusive.toISOString()),
    getShellAccessContext(user.id),
  ]);

  const allowed = accessContext?.allowedNavKeys ?? [...ALL_SHELL_NAV_KEYS];
  const hasHygieneAccess = accessContext?.isOwner || allowed.includes("hygiene") || allowed.includes("cuisine");
  const serviceIds = (recentServices ?? []).map((s) => s.id);

  const [hygieneResults, { data: aggregates }] = await Promise.all([
    hasHygieneAccess
      ? Promise.all([
          cachedListTemperaturePoints(restaurant.id).then((points) => points.filter((p) => p.active)),
          loadDashboardHygieneTileData(restaurant.id),
        ])
      : Promise.resolve([[], null] as [never[], null]),
    getServiceSalesAggregate(serviceIds),
  ]);
  const [temperaturePoints, hygieneTile] = hygieneResults;

  const myShiftsForClock =
    staffForClock != null
      ? shiftsWeek.filter((s) => s.staff_member_id === staffForClock.id)
      : [];

  let totalSalesRecent = 0;
  let totalLinesRecent = 0;
  if (aggregates) {
    for (const a of aggregates.values()) {
      totalSalesRecent += a.totalQty;
      totalLinesRecent += a.lines;
    }
  }

  const lastFiveServices = (recentServices ?? []).slice(0, 5);
  const inventoryCount = stockSummary?.inventoryCount ?? 0;
  const belowMinStockCount = stockSummary?.belowMinStockCount ?? 0;
  const isOwner = accessContext?.isOwner ?? false;

  const visibleQuickActions = quickActions.filter((action) => allowed.includes(action.navKey));
  // Pour le propriétaire : toutes les rubriques visibles (pas de restriction).
  // Pour un collaborateur : chaque rubrique nécessite sa clé spécifique.
  const showStats = isOwner || allowed.includes("dashboard_stats");
  const showRecentServices = isOwner || allowed.includes("dashboard_recent_services");
  const showStockAlert = isOwner || allowed.includes("dashboard_stock_alert");

  // Bande « Maintenant » : uniquement les signaux réellement en attente.
  const hygienePending = hasHygieneAccess ? hygieneTile?.tasks.length ?? 0 : 0;
  const focusItems: FocusItem[] = [];
  if (hygienePending > 0) {
    focusItems.push({
      tone: "copper",
      icon: Droplets,
      count: hygienePending,
      title: hygienePending > 1 ? "tâches d’hygiène à faire" : "tâche d’hygiène à faire",
      cta: "Ouvrir le suivi hygiène",
      href: "/hygiene/a-faire",
    });
  }
  if (showStockAlert && belowMinStockCount > 0) {
    focusItems.push({
      tone: "amber",
      icon: Package,
      count: belowMinStockCount,
      title: belowMinStockCount > 1 ? "produits bientôt en rupture" : "produit bientôt en rupture",
      cta: "Voir le stock",
      href: "/inventory",
    });
  }
  // L'état calme n'est montré qu'aux utilisateurs concernés par ces signaux.
  const showFocusBand = hasHygieneAccess || showStockAlert;

  const cardBase = "rounded-2xl border border-stone-100 bg-white shadow-sm";

  return (
    <DayClockShell restaurantId={restaurant.id} myShifts={myShiftsForClock} temperaturePoints={temperaturePoints}>
      <PageContainer>
        <PageHeader
          title="Tableau de bord"
          subtitle={
            <>
              <span className="font-medium text-stone-700">{restaurant.name}</span>
              <span className="text-stone-400"> · </span>
              activité récente
            </>
          }
        />

        {showFocusBand ? <DashboardFocusBand items={focusItems} /> : null}

        <section aria-labelledby="quick-actions-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="quick-actions-heading" className="text-sm font-semibold text-stone-900">
                Où voulez-vous aller ?
              </h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Les accès rapides suivent les grandes zones du restaurant.
              </p>
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            {visibleQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-copper-100 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-xl bg-copper-50 p-2.5 text-copper-800">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-stone-300 transition group-hover:text-copper-600" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-stone-900">{action.label}</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {hasHygieneAccess && hygieneTile ? (
          <DashboardHygieneTile
            score={hygieneTile.score}
            scoreDetail={hygieneTile.scoreDetail}
            tasks={hygieneTile.tasks}
          />
        ) : null}

        {/* Stats */}
      {showStats && (
      <section aria-label="Indicateurs récents">
        <h2 className="sr-only">Statistiques</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Services récents"
            value={recentServices?.length ?? 0}
            hint="Les 10 derniers"
            icon={CalendarDays}
          />
          <StatTile
            label="Plats vendus"
            value={totalSalesRecent}
            hint="Sur ces services"
            icon={UtensilsCrossed}
          />
          <StatTile
            label="Ventes enregistrées"
            value={totalLinesRecent}
            hint="Lignes de tickets"
            icon={Layers}
          />
          <StatTile
            label="Produits en stock"
            value={inventoryCount}
            hint="Ingrédients suivis"
            icon={Package}
          />
        </div>
      </section>
      )}

      {/* Derniers services — tableau */}
      {showRecentServices && lastFiveServices.length > 0 ? (
        <section className={cardBase} aria-labelledby="services-heading">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-100 px-4 py-4 sm:px-6">
            <div>
              <h2 id="services-heading" className="text-sm font-semibold text-stone-900">
                Derniers services
              </h2>
              <p className="mt-0.5 text-xs text-stone-500">Accès rapide aux tickets récents</p>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-1 text-sm font-semibold text-copper-700 hover:text-copper-600"
            >
              Tout l’historique
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/90 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3 sm:px-6">Date</th>
                  <th className="px-4 py-3 sm:px-6">Service</th>
                  <th className="px-4 py-3 text-right sm:px-6">Qté vendue</th>
                  <th className="px-4 py-3 text-right sm:px-6">Lignes</th>
                  <th className="w-12 px-4 py-3 sm:px-6" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lastFiveServices.map((s) => {
                  const agg = aggregates?.get(s.id) ?? { lines: 0, totalQty: 0 };
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-stone-50/80">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-stone-900 sm:px-6">
                        {formatDate(s.service_date)}
                      </td>
                      <td className="px-4 py-3 text-stone-600 sm:px-6">
                        <span className="inline-flex rounded-lg bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
                          {formatServiceTypeLong(s.service_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-stone-800 sm:px-6">
                        {agg.totalQty}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-stone-500 sm:px-6">
                        {agg.lines}
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        <Link
                          href={`/service/${s.id}`}
                          className="inline-flex rounded-lg p-1.5 text-copper-700 transition hover:bg-copper-50"
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
      </PageContainer>
    </DayClockShell>
  );
}
