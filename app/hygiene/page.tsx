import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ClipboardList,
  FileClock,
  LayoutGrid,
  ListChecks,
  Snowflake,
  SprayCan,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import {
  countHygieneTasksDue,
  getHygieneScoreForRestaurant,
  listHygieneElements,
  listHygieneRegister,
  listHygieneTasksDue,
  listHygieneTasksUpcoming,
} from "@/lib/hygiene/hygieneDb";
import { HYGIENE_RISK_LEVELS, type HygieneRiskLevel } from "@/lib/hygiene/types";
import { cachedEnsureHygieneTasks } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";
import { RiskPill, ScoreGauge, StatTile, fmtWhen, scoreBand } from "./hygieneUi";
import { HygieneDueTasksClient } from "./HygieneDueTasksClient";

type Shortcut = {
  href: string;
  title: string;
  icon: LucideIcon;
  tone: string;
  hover: string;
  badge?: number;
};

const RISK_DOT: Record<HygieneRiskLevel, string> = {
  critical: "bg-rose-500",
  important: "bg-amber-500",
  standard: "bg-stone-300",
};

/** Instant courant (isolé dans un helper : requête serveur dynamique, pas de rendu figé). */
function currentMs(): number {
  return Date.now();
}

export default async function HygieneHubPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await cachedEnsureHygieneTasks(restaurant.id);
  const [score, dueTasks, dueCount, upcoming, elements, register] = await Promise.all([
    getHygieneScoreForRestaurant(restaurant.id, 7),
    listHygieneTasksDue(restaurant.id, 200),
    countHygieneTasksDue(restaurant.id),
    listHygieneTasksUpcoming(restaurant.id, 8),
    listHygieneElements(restaurant.id),
    listHygieneRegister(restaurant.id, 200),
  ]);

  const nowMs = currentMs();
  const hasScoreData = score.max > 0;
  const band = scoreBand(score.score, hasScoreData);

  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const completed7d = register.filter(
    (t) => t.completed_at && new Date(t.completed_at).getTime() >= weekAgo
  ).length;

  const riskCounts: Record<HygieneRiskLevel, number> = { critical: 0, important: 0, standard: 0 };
  for (const t of dueTasks) riskCounts[t.risk_level] = (riskCounts[t.risk_level] ?? 0) + 1;

  const shortcuts: Shortcut[] = [
    { href: "/hygiene/a-faire", title: "À faire maintenant", icon: ListChecks, tone: "bg-amber-50 text-amber-700", hover: "tile-amber", badge: dueCount },
    { href: "/hygiene/elements", title: "Éléments à nettoyer", icon: SprayCan, tone: "bg-cyan-50 text-cyan-700", hover: "tile-cyan" },
    { href: "/hygiene/registre", title: "Registre nettoyage", icon: ClipboardList, tone: "bg-sky-50 text-sky-700", hover: "tile-sky" },
    { href: "/hygiene/haccp", title: "Températures HACCP", icon: Thermometer, tone: "bg-emerald-50 text-emerald-700", hover: "tile-emerald" },
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

      {/* ═══ Héros : score + chiffres clés ═══ */}
      <section className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm">
          <ScoreGauge score={score.score} hasData={hasScoreData} />
          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${band.chip}`}>
            {band.label}
          </span>
          <p className="text-center text-xs leading-relaxed text-stone-400">Score hygiène · 7 derniers jours</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="À faire maintenant"
              value={dueCount}
              icon={ListChecks}
              tone={dueCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}
              emphasis={dueCount > 0}
            />
            <StatTile label="Éléments au plan" value={elements.length} icon={SprayCan} tone="bg-cyan-50 text-cyan-700" />
            <StatTile label="Réalisées (7 j)" value={completed7d} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" />
          </div>

          {dueCount > 0 ? (
            <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
                Répartition des tâches à faire
              </p>
              <div className="grid grid-cols-3 gap-2">
                {HYGIENE_RISK_LEVELS.map((level) => (
                  <div key={level} className="rounded-xl border border-stone-200/70 bg-stone-50/50 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${RISK_DOT[level]}`} />
                      <RiskPill level={level} />
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-stone-900">{riskCounts[level]}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
              <Sparkles className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold">Tout est à jour</p>
                <p className="text-xs text-emerald-700">Aucune tâche de nettoyage en retard. Beau travail !</p>
              </div>
            </div>
          )}
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
          <ul className="space-y-2">
            {upcoming.slice(0, 6).map((t) => {
              const when = fmtWhen(t.due_at, nowMs);
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm"
                >
                  <RiskPill level={t.risk_level} />
                  <span className="min-w-0 flex-1">
                    <span className="truncate font-medium text-stone-900">{t.element_name}</span>
                    {t.area_label ? <span className="ml-1.5 text-xs text-stone-400">· {t.area_label}</span> : null}
                  </span>
                  <span className="text-xs text-stone-500">
                    {when.abs} <span className="text-stone-400">· {when.hint}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </PageContainer>
  );
}
