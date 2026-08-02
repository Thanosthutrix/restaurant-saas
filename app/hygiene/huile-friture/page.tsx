import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Droplets, FileClock, ListChecks, SlidersHorizontal, Thermometer } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import {
  countPendingFryerOilTasks,
  ensureFryerOilTasksForRestaurant,
  listFryerOilLogs,
  listFryerUnits,
} from "@/lib/fryerOil/fryerOilDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { StatTile, fmtWhen } from "../hygieneUi";
import { FryerStatusPill, fmtOilTemp, fmtTpm } from "./fryerOilUi";

const ACCENT = "bg-amber-50 text-amber-800";

type Shortcut = { href: string; title: string; icon: LucideIcon; tone: string; tile: string; badge?: number };

export default async function FryerOilHubPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await ensureFryerOilTasksForRestaurant(restaurant.id, 14);
  const [pendingCount, units, recentLogs] = await Promise.all([
    countPendingFryerOilTasks(restaurant.id),
    listFryerUnits(restaurant.id),
    listFryerOilLogs(restaurant.id, { limit: 100 }),
  ]);

  const nowMs = Date.now();
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const activeUnits = units.filter((u) => u.active).length;
  const anomalies = recentLogs.filter(
    (l) => l.log_status !== "normal" && new Date(l.created_at).getTime() >= weekAgo
  );

  const shortcuts: Shortcut[] = [
    {
      href: "/hygiene/huile-friture/check",
      title: "Contrôles à faire",
      icon: ListChecks,
      tone: "bg-amber-50 text-amber-800",
      tile: "tile-amber",
      badge: pendingCount,
    },
    {
      href: "/hygiene/huile-friture/units",
      title: "Friteuses",
      icon: SlidersHorizontal,
      tone: "bg-orange-50 text-orange-800",
      tile: "tile-orange",
    },
    {
      href: "/hygiene/huile-friture/registre",
      title: "Registre huile",
      icon: FileClock,
      tone: "bg-copper-50 text-copper-800",
      tile: "tile-copper",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Droplets}
        accentTone={ACCENT}
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Huile de friture" },
        ]}
        title="Huile de friteuse HACCP"
        subtitle="Contrôles TPM, température de friture, filtration et changements d'huile — registre traçable pour le contrôle sanitaire."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Contrôles à faire"
          value={pendingCount}
          icon={ListChecks}
          tone={pendingCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}
          emphasis={pendingCount > 0}
        />
        <StatTile label="Friteuses actives" value={activeUnits} icon={Droplets} tone={ACCENT} />
        <StatTile
          label="Anomalies (7 j)"
          value={anomalies.length}
          icon={AlertTriangle}
          tone={anomalies.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}
        />
      </section>

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

      {anomalies.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">Dernières anomalies (7 j)</h2>
          <ul className="space-y-2">
            {anomalies.slice(0, 5).map((l) => {
              const when = fmtWhen(l.created_at, nowMs);
              return (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-stone-200/70 bg-white px-4 py-3 shadow-sm"
                >
                  <FryerStatusPill status={l.log_status} />
                  <span className="min-w-0 flex-1 font-medium text-stone-900">{l.unit_name}</span>
                  <span className="text-sm tabular-nums text-stone-600">
                    TPM {fmtTpm(l.tpm_percent)} · {fmtOilTemp(l.oil_temperature_celsius)}
                  </span>
                  <span className="text-xs text-stone-400">{when.abs}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3">
        <Link
          href="/hygiene/haccp"
          className="flex items-center gap-3 text-sm text-sky-950 transition hover:text-sky-900"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
            <Thermometer className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="font-semibold">Températures HACCP</span>
            <span className="mt-0.5 block text-xs text-sky-800/80">
              Relevés froid / chaud — même registre traçable que les contrôles huile.
            </span>
          </span>
        </Link>
      </section>

      <p className="text-xs leading-relaxed text-stone-400">
        Référence : arrêté du 21/12/2009 — changement d&apos;huile recommandé à 25 % TPM (matières polaires).
        Filtration quotidienne et contrôle sensoriel (odeur, mousse, fumée) inclus dans chaque relevé.
      </p>
    </PageContainer>
  );
}
