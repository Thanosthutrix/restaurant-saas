"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  deletePlanningDayOverrideAction,
  savePublicHolidayPlanningDayAction,
  saveSchoolVacationPeriodPlanningAction,
} from "@/app/restaurants/actions";
import { findPresetForCalendarRow } from "@/lib/staff/planningBandPresets";
import type { PlanningBandPreset } from "@/lib/staff/planningBandPresets";
import type { PlanningDayOverrideRow } from "@/lib/staff/planningResolve";
import { parseTimeBandsArray } from "@/lib/staff/planningResolve";
import type { SchoolVacationPeriod } from "@/lib/franceCalendars/schoolVacations";
import { uiInput, uiLabel } from "@/components/ui/premium";

type PublicHoliday = { date: string; name: string };

type Props = {
  restaurantId: string;
  effectiveZone: "A" | "B" | "C";
  zoneIsAssumed: boolean;
  years: readonly number[];
  publicHolidaysByYear: Record<number, PublicHoliday[]>;
  schoolPeriodsByYear: Record<number, SchoolVacationPeriod[]>;
  overrides: PlanningDayOverrideRow[];
  bandPresets: PlanningBandPreset[];
};

function formatDayFrLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDayFrShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function etpFromSchedule(schedule: "inherit" | string, presets: PlanningBandPreset[]): number | null {
  if (schedule === "inherit" || schedule === "__custom__") return null;
  const p = presets.find((x) => x.id === schedule);
  if (!p || p.etp == null || !Number.isFinite(Number(p.etp))) return null;
  return Math.round(Number(p.etp) * 100) / 100;
}

/** Plages + ETP : modèle, id preset, ou personnalisé. */
function ferieOpenPlageValue(
  h: PublicHoliday,
  overrideByDay: Map<string, PlanningDayOverrideRow>,
  presets: PlanningBandPreset[]
): "inherit" | string {
  const row = overrideByDay.get(h.date);
  const cal = row?.calendar_source === "public_holiday" ? row : null;
  if (!cal || cal.is_closed) return "inherit";
  const bands = parseTimeBandsArray(cal.opening_bands_override);
  if (!bands?.length) return "inherit";
  const staff = cal.staff_target_override ?? null;
  const m = findPresetForCalendarRow(presets, bands, staff);
  return m?.id ?? "__custom__";
}

function vacationOpenPlageValue(
  period: SchoolVacationPeriod,
  overrideByDay: Map<string, PlanningDayOverrideRow>,
  presets: PlanningBandPreset[]
): "inherit" | string {
  const openDay = period.days.find((d) => {
    const r = overrideByDay.get(d);
    return r?.calendar_source === "school_vacation" && !r.is_closed;
  });
  if (!openDay) return "inherit";
  const r = overrideByDay.get(openDay)!;
  const bands = parseTimeBandsArray(r.opening_bands_override);
  if (!bands?.length) return "inherit";
  const staff = r.staff_target_override ?? null;
  const m = findPresetForCalendarRow(presets, bands, staff);
  return m?.id ?? "__custom__";
}

export function FranceCalendarGuidedPanel({
  restaurantId,
  effectiveZone,
  zoneIsAssumed,
  years,
  publicHolidaysByYear,
  schoolPeriodsByYear,
  overrides,
  bandPresets,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultYear = useMemo(() => {
    const y = new Date().getFullYear();
    return years.includes(y) ? y : years[0] ?? y;
  }, [years]);
  const [year, setYear] = useState(defaultYear);

  const overrideByDay = useMemo(() => new Map(overrides.map((r) => [r.day, r])), [overrides]);

  function refresh() {
    router.refresh();
  }

  function applyFerieOpenPlages(h: PublicHoliday, schedule: "inherit" | string) {
    setError(null);
    if (schedule === "__custom__") return;
    start(async () => {
      const preset = schedule === "inherit" ? null : bandPresets.find((p) => p.id === schedule);
      const bands = schedule === "inherit" ? null : preset?.bands;
      if (schedule !== "inherit" && !bands) {
        setError("Modèle de plages introuvable. Enregistrez d’abord vos modèles ci-dessus.");
        return;
      }
      const staffEtp = etpFromSchedule(schedule, bandPresets);
      const r = await savePublicHolidayPlanningDayAction(restaurantId, {
        day: h.date,
        open: true,
        holidayName: h.name,
        openingBandsOverride: bands ?? null,
        staffTargetOverride: staffEtp,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  function applyFerieBehavior(h: PublicHoliday, mode: "inherit" | "closed" | "open") {
    setError(null);
    start(async () => {
      if (mode === "inherit") {
        const row = overrideByDay.get(h.date);
        if (row?.calendar_source === "public_holiday") {
          const r = await deletePlanningDayOverrideAction(restaurantId, h.date);
          if (!r.ok) {
            setError(r.error);
            return;
          }
        }
        refresh();
        return;
      }
      if (mode === "closed") {
        const r = await savePublicHolidayPlanningDayAction(restaurantId, {
          day: h.date,
          open: false,
          holidayName: h.name,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        refresh();
        return;
      }
      const sched = ferieOpenPlageValue(h, overrideByDay, bandPresets);
      const effective = sched === "__custom__" ? "inherit" : sched;
      const preset = effective === "inherit" ? null : bandPresets.find((p) => p.id === effective);
      const bands = effective === "inherit" ? null : preset?.bands;
      if (effective !== "inherit" && !bands) {
        setError("Modèle de plages introuvable.");
        return;
      }
      const staffEtp = etpFromSchedule(effective, bandPresets);
      const r = await savePublicHolidayPlanningDayAction(restaurantId, {
        day: h.date,
        open: true,
        holidayName: h.name,
        openingBandsOverride: bands ?? null,
        staffTargetOverride: staffEtp,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  function saveVacationPeriod(
    p: SchoolVacationPeriod,
    openDuringVacation: boolean,
    schedule: "inherit" | string = "inherit"
  ) {
    setError(null);
    start(async () => {
      if (!openDuringVacation) {
        const r = await saveSchoolVacationPeriodPlanningAction(restaurantId, {
          days: p.days,
          openDuringVacation: false,
          periodName: p.name,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        refresh();
        return;
      }
      if (schedule === "__custom__") return;
      const vacPreset = schedule === "inherit" ? null : bandPresets.find((x) => x.id === schedule);
      const bands = schedule === "inherit" ? null : vacPreset?.bands;
      if (schedule !== "inherit" && !bands) {
        setError("Modèle de plages introuvable. Enregistrez d’abord vos modèles ci-dessus.");
        return;
      }
      const staffEtp = etpFromSchedule(schedule, bandPresets);
      const r = await saveSchoolVacationPeriodPlanningAction(restaurantId, {
        days: p.days,
        openDuringVacation: true,
        periodName: p.name,
        openingBandsOverride: bands ?? null,
        staffTargetOverride: staffEtp,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  const holidays = publicHolidaysByYear[year] ?? [];
  const periods = schoolPeriodsByYear[year] ?? [];

  return (
    <div className="space-y-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Calendrier France (fériés et vacances scolaires)</h3>
        <p className="mt-1 text-xs text-slate-600">
          Définissez d’abord des <strong className="font-medium text-slate-800">modèles de plages</strong> au-dessus si
          besoin (ex. été chargé). Ici, pour chaque jour férié ou période de vacances, choisissez fermeture, reprise du
          modèle hebdomadaire, ou ouverture avec le modèle hebdo ou un de vos modèles nommés.
        </p>
      </div>

      {zoneIsAssumed ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
          Aucune zone vacances n’est encore enregistrée pour ce restaurant : nous affichons la{" "}
          <strong className="font-medium">zone C</strong> par défaut. Indiquez la zone A, B ou C (académie) dans le
          formulaire du haut de page pour des dates de vacances adaptées.
        </p>
      ) : (
        <p className="text-xs text-slate-600">
          Zone vacances scolaires utilisée : <strong className="font-medium text-slate-800">{effectiveZone}</strong>
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={uiLabel} htmlFor="calendar-year">
            Année
          </label>
          <select
            id="calendar-year"
            className={`${uiInput} mt-1 min-w-[8rem]`}
            value={year}
            disabled={pending}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Jours fériés (métropole)</h4>
        <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Comportement</th>
                <th className="px-3 py-2">Si ouvert — plages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-slate-500">
                    Aucun jour férié pour cette année.
                  </td>
                </tr>
              ) : (
                holidays.map((h) => {
                  const row = overrideByDay.get(h.date);
                  const cal = row?.calendar_source === "public_holiday" ? row : null;
                  const manualOther = row && row.calendar_source !== "public_holiday";
                  const mode: "inherit" | "closed" | "open" = cal
                    ? cal.is_closed
                      ? "closed"
                      : "open"
                    : "inherit";
                  const plageVal = ferieOpenPlageValue(h, overrideByDay, bandPresets);
                  return (
                    <tr key={h.date} className="align-top">
                      <td className="px-3 py-2 tabular-nums text-slate-800">{formatDayFrLong(h.date)}</td>
                      <td className="px-3 py-2 text-slate-700">{h.name}</td>
                      <td className="px-3 py-2">
                        {manualOther ? (
                          <span className="text-xs text-amber-800">Exception manuelle — voir le tableau ci-dessous</span>
                        ) : (
                          <select
                            className={`${uiInput} max-w-[min(100%,14rem)] text-xs`}
                            value={mode}
                            disabled={pending}
                            onChange={(e) =>
                              applyFerieBehavior(h, e.target.value as "inherit" | "closed" | "open")
                            }
                          >
                            <option value="inherit">Modèle hebdo (pas d’exception férié)</option>
                            <option value="closed">Fermé</option>
                            <option value="open">Ouvert</option>
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {manualOther || mode !== "open" ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <select
                            className={`${uiInput} max-w-[min(100%,16rem)] text-xs`}
                            value={plageVal === "__custom__" ? "__custom__" : plageVal}
                            disabled={pending || plageVal === "__custom__"}
                            onChange={(e) => applyFerieOpenPlages(h, e.target.value)}
                          >
                            <option value="inherit">Horaires du jour type (semaine)</option>
                            {bandPresets.map((pr) => (
                              <option key={pr.id} value={pr.id}>
                                {pr.label}
                              </option>
                            ))}
                            {plageVal === "__custom__" ? (
                              <option value="__custom__" disabled>
                                Plages personnalisées (tableau exceptions)
                              </option>
                            ) : null}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Vacances scolaires</h4>
        <p className="text-xs text-slate-500">
          Ouvert : par défaut horaires du modèle hebdomadaire chaque jour. Vous pouvez appliquer un{" "}
          <strong className="font-medium">modèle de plages</strong> (ex. été renforcé) à toute la période.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-3 py-2">Période</th>
                <th className="px-3 py-2">Libellé</th>
                <th className="px-3 py-2">Ouvert</th>
                <th className="px-3 py-2">Si ouvert — plages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-slate-500">
                    Aucune période de vacances pour cette année et cette zone.
                  </td>
                </tr>
              ) : (
                periods.map((p) => (
                  <VacationPeriodRow
                    key={p.id}
                    period={p}
                    overrideByDay={overrideByDay}
                    bandPresets={bandPresets}
                    pending={pending}
                    onSave={saveVacationPeriod}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function VacationPeriodRow({
  period,
  overrideByDay,
  bandPresets,
  pending,
  onSave,
}: {
  period: SchoolVacationPeriod;
  overrideByDay: Map<string, PlanningDayOverrideRow>;
  bandPresets: PlanningBandPreset[];
  pending: boolean;
  onSave: (p: SchoolVacationPeriod, openDuring: boolean, schedule?: "inherit" | string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const days = period.days;
  let closedCal = 0;
  for (const d of days) {
    const r = overrideByDay.get(d);
    if (r?.calendar_source === "school_vacation" && r.is_closed) closedCal++;
  }
  const checked = closedCal === 0;
  const indeterminate = closedCal > 0 && closedCal < days.length;
  const plageVal = vacationOpenPlageValue(period, overrideByDay, bandPresets);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <tr className="align-top">
      <td className="px-3 py-2 tabular-nums text-slate-800">
        {formatDayFrShort(period.start)} → {formatDayFrShort(period.end)}
      </td>
      <td className="px-3 py-2 text-slate-700">{period.name}</td>
      <td className="px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            ref={ref}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            checked={checked}
            disabled={pending}
            onChange={(e) => {
              const on = e.target.checked;
              if (!on) onSave(period, false, "inherit");
              else onSave(period, true, vacationOpenPlageValue(period, overrideByDay, bandPresets));
            }}
          />
          <span className="text-xs text-slate-600">Ouvert</span>
        </label>
        {indeterminate ? (
          <p className="mt-1 text-[11px] text-amber-800">Partiellement fermé — cochez pour réaligner toute la période.</p>
        ) : null}
      </td>
      <td className="px-3 py-2">
        {!checked ? (
          <span className="text-slate-400">—</span>
        ) : (
          <select
            className={`${uiInput} max-w-[min(100%,16rem)] text-xs`}
            value={plageVal === "__custom__" ? "__custom__" : plageVal}
            disabled={pending || plageVal === "__custom__"}
            onChange={(e) => onSave(period, true, e.target.value)}
          >
            <option value="inherit">Horaires du jour type</option>
            {bandPresets.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.label}
              </option>
            ))}
            {plageVal === "__custom__" ? (
              <option value="__custom__" disabled>
                Plages personnalisées (exceptions)
              </option>
            ) : null}
          </select>
        )}
      </td>
    </tr>
  );
}
