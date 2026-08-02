import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Droplets,
  FileClock,
  LayoutGrid,
  ListChecks,
  Snowflake,
  SprayCan,
  Thermometer,
} from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import {
  countHygieneTasksDue,
  getHygieneScoreForRestaurant,
  listHygieneTasksDue,
  listHygieneTasksUpcoming,
} from "@/lib/hygiene/hygieneDb";
import { cachedEnsureHygieneTasks } from "@/lib/cache";
import {
  countPendingFryerOilTasks,
  ensureFryerOilTasksForRestaurant,
} from "@/lib/fryerOil/fryerOilDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";
import { ScoreGauge, scoreBand } from "./hygieneUi";
import { HygieneDueTasksClient } from "./HygieneDueTasksClient";
import { HygieneTaskTileGrid } from "@/components/hygiene/HygieneTaskTileGrid";

type Shortcut = {
  href: string;
  title: string;
  icon: LucideIcon;
  tone: string;
  hover: string;
  badge?: number;
};

export default async function HygieneHubPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await Promise.all([
    cachedEnsureHygieneTasks(restaurant.id),
    ensureFryerOilTasksForRestaurant(restaurant.id, 14),
  ]);
  const [score, dueTasks, dueCount, upcoming, fryerOilPendingCount] = await Promise.all([
    getHygieneScoreForRestaurant(restaurant.id, 7),
    listHygieneTasksDue(restaurant.id, 200),
    countHygieneTasksDue(restaurant.id),
    listHygieneTasksUpcoming(restaurant.id, 8),
    countPendingFryerOilTasks(restaurant.id),
  ]);

  const hasScoreData = score.max > 0;
  const band = scoreBand(score.score, hasScoreData);

  const shortcuts: Shortcut[] = [
    { href: "/hygiene/a-faire", title: "À faire maintenant", icon: ListChecks, tone: "bg-amber-50 text-amber-700", hover: "tile-amber", badge: dueCount },
    { href: "/hygiene/elements", title: "Éléments à nettoyer", icon: SprayCan, tone: "bg-cyan-50 text-cyan-700", hover: "tile-cyan" },
    { href: "/hygiene/registre", title: "Registre nettoyage", icon: ClipboardList, tone: "bg-sky-50 text-sky-700", hover: "tile-sky" },
    { href: "/hygiene/haccp", title: "Températures HACCP", icon: Thermometer, tone: "bg-emerald-50 text-emerald-700", hover: "tile-emerald" },
    {
      href: "/hygiene/huile-friture",
      title: "Huile de friteuse",
      icon: Droplets,
      tone: "bg-amber-50 text-amber-800",
      hover: "tile-amber",
      badge: fryerOilPendingCount,
    },
    { href: "/hygiene/temperatures-ouverture", title: "Froid : ouverture / fermeture", icon: Snowflake, tone: "bg-violet-50 text-violet-700", hover: "tile-violet" },
    { href: "/hygiene/cuisine-plan", title: "Plan cuisine", icon: LayoutGrid, tone: "bg-indigo-50 text-indigo-700", hover: "tile-indigo" },
    { href: "/hygiene/registre-temperatures", title: "Registre froid", icon: FileClock, tone: "bg-copper-50 text-copper-700", hover: "tile-copper" },
  ];

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.hygiene.icon}
        accentTone={SECTION_ACCENT.hygiene.tone}
        breadcrumbs={[{ label: "Cuisine", href: "/cuisine" }, { label: "Nettoyage & désinfection" }]}
        title="Nettoyage & désinfection"
        subtitle="Votre plan de nettoyage en un coup d’œil : score des 7 derniers jours, tâches à traiter et échéances à venir."
      />

      {/* ═══ Score hygiène ═══ */}
      <section className="flex justify-center sm:justify-start">
        <div className="flex w-full max-w-xs flex-col items-center justify-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
          <ScoreGauge score={score.score} hasData={hasScoreData} />
          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${band.chip}`}>
            {band.label}
          </span>
          <p className="text-center text-xs leading-relaxed text-stone-400">Score hygiène · 7 derniers jours</p>
        </div>
      </section>

      {/* ═══ Raccourcis (tuiles) ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-900">Accès rapides</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`group relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${s.hover}`}
              >
                {s.badge && s.badge > 0 ? (
                  <span className="absolute right-2 top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
                    {s.badge > 99 ? "99+" : s.badge}
                  </span>
                ) : null}
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.tone}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                  {s.title}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ═══ À traiter maintenant (cliquable → validation) ═══ */}
      {dueTasks.length > 0 ? (
        <HygieneDueTasksClient restaurantId={restaurant.id} tasks={dueTasks.slice(0, 6)} dueCount={dueCount} />
      ) : null}

      {/* ═══ À venir ═══ */}
      {upcoming.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Prochaines échéances</h2>
          <HygieneTaskTileGrid tasks={upcoming.slice(0, 6)} />
        </section>
      ) : null}
    </PageContainer>
  );
}
