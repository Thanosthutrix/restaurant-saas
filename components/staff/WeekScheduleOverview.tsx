"use client";

import { useMemo } from "react";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import { minutesFromMidnight, PLANNING_DAY_KEYS, PLANNING_DAY_LABELS_FR } from "@/lib/staff/planningHoursTypes";
import type { PlanningAlert } from "@/lib/staff/planningAlerts";
import { addDays, parseISODateLocal } from "@/lib/staff/weekUtils";

const STAFF_LAYER_CLASS = [
  "bg-violet-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-fuchsia-600",
  "bg-lime-700",
  "bg-orange-600",
  "bg-sky-600",
  "bg-teal-600",
];

function staffInitials(displayName: string): string {
  const p = displayName.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

function dayBoundsLocal(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Position du créneau dans [minM, maxM] en minutes depuis minuit, exprimé en % de la colonne. */
function segmentPctInRange(
  shiftStart: Date,
  shiftEnd: Date,
  day: Date,
  rangeMinM: number,
  rangeMaxM: number
): { top: number; height: number } | null {
  const { start: day0 } = dayBoundsLocal(day);
  const s = Math.max(shiftStart.getTime(), day0.getTime());
  const e = Math.min(shiftEnd.getTime(), day0.getTime() + 24 * 60 * 60000);
  if (s >= e) return null;
  const sm = (s - day0.getTime()) / 60000;
  const em = (e - day0.getTime()) / 60000;
  const span = rangeMaxM - rangeMinM;
  if (span <= 0) return null;
  const t0 = Math.max(sm, rangeMinM);
  const t1 = Math.min(em, rangeMaxM);
  if (t1 <= t0) return null;
  return {
    top: ((t0 - rangeMinM) / span) * 100,
    height: ((t1 - t0) / span) * 100,
  };
}

function openingBandPctInRange(
  day: Date,
  bandStart: string,
  bandEnd: string,
  rangeMinM: number,
  rangeMaxM: number
): { top: number; height: number } | null {
  const a = minutesFromMidnight(bandStart);
  const b = minutesFromMidnight(bandEnd);
  if (a == null || b == null || b <= a) return null;
  const { start: day0 } = dayBoundsLocal(day);
  const s = new Date(day0.getTime() + a * 60000);
  const e = new Date(day0.getTime() + b * 60000);
  return segmentPctInRange(s, e, day, rangeMinM, rangeMaxM);
}

function shiftsForCalendarDay(shifts: WorkShiftWithDetails[], day: Date): WorkShiftWithDetails[] {
  const d0 = dayBoundsLocal(day).start.getTime();
  const d1 = d0 + 24 * 60 * 60000;
  return shifts.filter((s) => {
    const a = new Date(s.starts_at).getTime();
    return a >= d0 && a < d1;
  });
}

function computeTimeRange(
  shifts: WorkShiftWithDetails[],
  resolvedWeekDays: WeekResolvedDay[]
): { minM: number; maxM: number } {
  let lo = 24 * 60;
  let hi = 0;
  let any = false;
  for (const wd of resolvedWeekDays) {
    for (const b of wd.openingBands) {
      const a = minutesFromMidnight(b.start);
      const e = minutesFromMidnight(b.end);
      if (a != null && e != null && e > a) {
        any = true;
        lo = Math.min(lo, a);
        hi = Math.max(hi, e);
      }
    }
  }
  for (const s of shifts) {
    const st = new Date(s.starts_at);
    const en = new Date(s.ends_at);
    if (st.toDateString() !== en.toDateString()) continue;
    const ds = st.getHours() * 60 + st.getMinutes();
    const de = en.getHours() * 60 + en.getMinutes();
    any = true;
    lo = Math.min(lo, ds);
    hi = Math.max(hi, de);
  }
  if (!any) return { minM: 6 * 60, maxM: 23 * 60 };
  lo = Math.max(0, lo - 60);
  hi = Math.min(24 * 60, hi + 60);
  if (hi <= lo) return { minM: 6 * 60, maxM: 23 * 60 };
  return { minM: lo, maxM: hi };
}

function headcountAt(
  shifts: WorkShiftWithDetails[],
  day: Date,
  rangeMinM: number,
  rangeMaxM: number,
  stepM: number
): number[] {
  const list = shiftsForCalendarDay(shifts, day);
  const out: number[] = [];
  for (let t = rangeMinM; t < rangeMaxM; t += stepM) {
    let c = 0;
    for (const s of list) {
      const a = new Date(s.starts_at);
      const e = new Date(s.ends_at);
      const am = a.getHours() * 60 + a.getMinutes();
      const em = e.getHours() * 60 + e.getMinutes();
      if (am < t + stepM && em > t) c++;
    }
    out.push(c);
  }
  return out;
}

type Props = {
  weekMondayIso: string;
  staff: StaffMember[];
  shifts: WorkShiftWithDetails[];
  resolvedWeekDays: WeekResolvedDay[];
  alerts: PlanningAlert[];
};

export function WeekScheduleOverview({ weekMondayIso, staff, shifts, resolvedWeekDays, alerts }: Props) {
  const monday = useMemo(() => parseISODateLocal(weekMondayIso), [weekMondayIso]);
  const weekDays = useMemo(() => {
    if (!monday) return [];
    return PLANNING_DAY_KEYS.map((_, i) => addDays(monday, i));
  }, [monday]);

  const { minM, maxM } = useMemo(
    () => computeTimeRange(shifts, resolvedWeekDays),
    [shifts, resolvedWeekDays]
  );

  const staffColorIndex = useMemo(() => {
    const sorted = [...staff].sort((a, b) => a.id.localeCompare(b.id));
    const m = new Map<string, number>();
    sorted.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [staff]);

  const hourTicks = useMemo(() => {
    const ticks: number[] = [];
    const startH = Math.floor(minM / 60);
    const endH = Math.ceil(maxM / 60);
    for (let h = startH; h <= endH; h++) ticks.push(h);
    return ticks;
  }, [minM, maxM]);

  if (!monday || weekDays.length === 0) return null;

  const rangeSpan = maxM - minM;
  const colTotalH = 432;
  const headH = 36;

  return (
    <div className="space-y-3">
      {alerts.length > 0 ? (
        <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm">
          {alerts.map((a, i) => (
            <li
              key={i}
              className={
                a.level === "error"
                  ? "text-red-900"
                  : a.level === "warning"
                    ? "text-amber-950"
                    : "text-slate-700"
              }
            >
              <span className="font-semibold">
                {a.level === "error" ? "Erreur" : a.level === "warning" ? "Attention" : "Info"}
                :{" "}
              </span>
              {a.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
          Aucune alerte automatique sur cette semaine (chevauchements, plages, volumes…).
        </p>
      )}

      <div className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
        <div className="min-w-[880px]">
          <div
            className="grid border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"
            style={{ gridTemplateColumns: `3rem repeat(7, minmax(0,1fr))` }}
          >
            <div className="px-1 py-2 text-center text-[10px] leading-tight text-slate-500">Heures</div>
            {resolvedWeekDays.map((wd) => (
              <div key={wd.ymd} className="border-l border-slate-100 px-1 py-2 text-center">
                {PLANNING_DAY_LABELS_FR[wd.dayKey]}
                <div className="font-normal text-[10px] text-slate-400">
                  {wd.date.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                {wd.openingBands.length === 0 ? (
                  <div className="text-[10px] font-medium text-rose-700">Fermé</div>
                ) : null}
                {wd.staffTarget != null ? (
                  <div className="text-[10px] font-medium text-indigo-800">Obj. {wd.staffTarget} pers.</div>
                ) : null}
                {wd.exceptionLabel ? (
                  <div className="line-clamp-2 text-[9px] text-amber-900" title={wd.exceptionLabel}>
                    {wd.exceptionLabel}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: `3rem repeat(7, minmax(0,1fr))` }}>
            <div
              className="flex flex-col border-r border-slate-200 bg-slate-50/80"
              style={{ height: colTotalH }}
            >
              <div className="relative min-h-0 flex-1">
                {hourTicks.map((h) => {
                  const minute = h * 60;
                  if (minute < minM || minute > maxM) return null;
                  const pct = ((minute - minM) / rangeSpan) * 100;
                  return (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-slate-200/90 text-[9px] text-slate-500"
                      style={{ top: `${pct}%` }}
                    >
                      <span className="absolute -top-2 left-0.5 tabular-nums">
                        {String(h).padStart(2, "0")}h
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                className="flex shrink-0 items-center justify-center border-t border-slate-200 bg-white text-[9px] text-slate-500"
                style={{ height: headH }}
              >
                Eff.
              </div>
            </div>

            {PLANNING_DAY_KEYS.map((_, di) => {
              const day = weekDays[di];
              const wd = resolvedWeekDays[di];
              const dayShifts = shiftsForCalendarDay(shifts, day);
              const stepM = Math.max(30, Math.min(90, Math.ceil(rangeSpan / 14)));
              const hc = headcountAt(shifts, day, minM, maxM, stepM);
              const maxHc = Math.max(1, ...hc);

              return (
                <div
                  key={wd.ymd}
                  className={`flex flex-col border-l border-slate-100 ${
                    wd.openingBands.length === 0 ? "bg-rose-50/40" : "bg-slate-50/30"
                  }`}
                  style={{ height: colTotalH }}
                >
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    {hourTicks.map((h) => {
                      const minute = h * 60;
                      if (minute < minM || minute > maxM) return null;
                      const pct = ((minute - minM) / rangeSpan) * 100;
                      return (
                        <div
                          key={`g-${h}`}
                          className="pointer-events-none absolute left-0 right-0 border-t border-slate-200/60"
                          style={{ top: `${pct}%` }}
                        />
                      );
                    })}

                    {wd.openingBands.map((band, bi) => {
                      const p = openingBandPctInRange(day, band.start, band.end, minM, maxM);
                      if (!p) return null;
                      return (
                        <div
                          key={`o-${bi}`}
                          className="pointer-events-none absolute left-0.5 right-0.5 rounded-sm bg-emerald-200/45 ring-1 ring-emerald-300/35"
                          style={{ top: `${p.top}%`, height: `${Math.max(p.height, 1)}%` }}
                          title={`Ouverture ${band.start}–${band.end}`}
                        />
                      );
                    })}

                    {dayShifts.map((s) => {
                      const seg = segmentPctInRange(
                        new Date(s.starts_at),
                        new Date(s.ends_at),
                        day,
                        minM,
                        maxM
                      );
                      if (!seg) return null;
                      const idx = staffColorIndex.get(s.staff_member_id) ?? 0;
                      const layer = STAFF_LAYER_CLASS[idx % STAFF_LAYER_CLASS.length];
                      const br = s.break_minutes != null ? ` · pause ${s.break_minutes} min` : "";
                      return (
                        <div
                          key={s.id}
                          className={`absolute left-1 right-1 z-10 flex items-center justify-center rounded border border-white/30 ${layer} px-0.5 text-[10px] font-bold leading-none text-white shadow-md`}
                          style={{
                            top: `${seg.top}%`,
                            height: `${Math.max(seg.height, 4)}%`,
                            minHeight: "18px",
                          }}
                          title={`${s.staff_display_name} · ${new Date(s.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${new Date(s.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}${br}`}
                        >
                          {staffInitials(s.staff_display_name)}
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className="flex w-full shrink-0 items-end gap-px border-t border-slate-200 bg-white/95 px-0.5"
                    style={{ height: headH }}
                  >
                    {hc.map((n, i) => (
                      <div
                        key={i}
                        className="flex h-full min-w-0 flex-1 flex-col justify-end"
                        title={`${n} présent(s)`}
                      >
                        <div
                          className="w-full rounded-t bg-indigo-600/90 text-center text-[8px] font-bold leading-none text-white"
                          style={{
                            height: `${(n / maxHc) * 100}%`,
                            minHeight: n > 0 ? 12 : 2,
                            opacity: n > 0 ? 1 : 0.2,
                          }}
                        >
                          {n > 0 ? n : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded bg-emerald-200/80 ring-1 ring-emerald-300/50" />
            Ouverture au public
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded bg-indigo-600/90" />
            Nombre de personnes présentes (barres proportionnelles, tranches adaptées à la plage affichée)
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {staff.map((m) => {
            const idx = staffColorIndex.get(m.id) ?? 0;
            const layer = STAFF_LAYER_CLASS[idx % STAFF_LAYER_CLASS.length];
            return (
              <span key={m.id} className="inline-flex items-center gap-1">
                <span className={`h-3 w-3 rounded-sm ${layer}`} />
                <span className="text-slate-700">{m.display_name}</span>
                <span className="text-slate-400">({staffInitials(m.display_name)})</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
