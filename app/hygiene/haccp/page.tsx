import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, FileClock, ListChecks, ShieldCheck, SlidersHorizontal, Thermometer } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import {
  countPendingTemperatureTasks,
  ensureTemperatureTasksForRestaurant,
  listTemperaturePoints,
  listTemperatureLogs,
} from "@/lib/haccpTemperature/haccpTemperatureDb";
import { TEMPERATURE_POINT_TYPE_LABEL_FR } from "@/lib/haccpTemperature/types";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { StatTile, fmtWhen } from "../hygieneUi";
import { StatusPill, fmtTemp } from "./haccpUi";

const ACCENT = "bg-sky-50 text-sky-700";

type Shortcut = { href: string; title: string; icon: LucideIcon; tone: string; tile: string; badge?: number };

function currentMs(): number {
  return Date.now();
}

export default async function HaccpHubPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await ensureTemperatureTasksForRestaurant(restaurant.id, 14);
  const [pendingCount, points, recentLogs] = await Promise.all([
    countPendingTemperatureTasks(restaurant.id),
    listTemperaturePoints(restaurant.id),
    listTemperatureLogs(restaurant.id, { limit: 100 }),
  ]);

  const nowMs = currentMs();
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const activePoints = points.filter((p) => p.active).length;
  const anomalies = recentLogs.filter(
    (l) => l.log_status !== "normal" && new Date(l.created_at).getTime() >= weekAgo
  );
  const recentAnomalies = anomalies.slice(0, 5);

  const shortcuts: Shortcut[] = [
    { href: "/hygiene/haccp/check", title: "Relevés à faire", icon: ListChecks, tone: "bg-amber-50 text-amber-700", tile: "tile-amber", badge: pendingCount },
    { href: "/hygiene/haccp/points", title: "Points de mesure", icon: SlidersHorizontal, tone: "bg-sky-50 text-sky-700", tile: "tile-sky" },
    { href: "/hygiene/haccp/registre", title: "Registre des relevés", icon: FileClock, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" },
  ];

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Thermometer}
        accentTone={ACCENT}
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Températures HACCP" },
        ]}
        title="Températures HACCP"
        subtitle="Points de mesure, relevés planifiés, anomalies et registre — tout ce qu’il faut pour prouver la maîtrise de la chaîne du froid et du chaud."
      />

      {/* Chiffres clés */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Relevés à faire"
          value={pendingCount}
          icon={ListChecks}
          tone={pendingCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}
          emphasis={pendingCount > 0}
        />
        <StatTile label="Points actifs" value={activePoints} icon={SlidersHorizontal} tone="bg-sky-50 text-sky-700" />
        <StatTile
          label="Anomalies (7 j)"
          value={anomalies.length}
          icon={AlertTriangle}
          tone={anomalies.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}
        />
      </section>

      {/* Accès rapides */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-900">Accès rapides</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`group relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${s.tile}`}
              >
                {s.badge && s.badge > 0 ? (
                  <span className="absolute right-2 top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
                    {s.badge > 99 ? "99+" : s.badge}
                  </span>
                ) : null}
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.tone}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="text-[13px] font-semibold leading-tight tracking-tight text-stone-900">{s.title}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Dernières anomalies */}
      {recentLogs.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Dernières anomalies (7 j)</h2>
          {recentAnomalies.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
              <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold">Tout est dans les seuils</p>
                <p className="text-xs text-emerald-700">Aucune anomalie de température sur les 7 derniers jours.</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentAnomalies.map((l) => {
                const when = fmtWhen(l.created_at, nowMs);
                return (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm"
                  >
                    <StatusPill status={l.log_status} />
                    <span className="min-w-0 flex-1">
                      <span className="truncate font-medium text-stone-900">{l.point_name}</span>
                      <span className="ml-1.5 text-xs text-stone-400">
                        · {TEMPERATURE_POINT_TYPE_LABEL_FR[l.point_type]}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-stone-800">{fmtTemp(l.value)}</span>
                    <span className="text-xs text-stone-400">{when.abs}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-stone-400">
        Les seuils et la marge d’« alerte » (proche limite) sont configurables par point. Une action corrective est
        exigée si la mesure est en alerte ou critique.
      </p>
    </PageContainer>
  );
}
