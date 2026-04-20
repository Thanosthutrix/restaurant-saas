"use client";

import { useMemo } from "react";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import { minutesFromMidnight, PLANNING_DAY_KEYS, PLANNING_DAY_LABELS_FR } from "@/lib/staff/planningHoursTypes";
import type { PlanningAlert } from "@/lib/staff/planningAlerts";
import { computePlanningWeekTimeRange } from "@/lib/staff/planningGridRange";
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

/** Minutes depuis minuit pour le début / fin d’un shift ce jour-là (même jour calendaire). */
function shiftMinuteBoundsOnDay(s: WorkShiftWithDetails, day: Date): { startM: number; endM: number } | null {
  const st = new Date(s.starts_at);
  const en = new Date(s.ends_at);
  if (st.toDateString() !== en.toDateString()) return null;
  const d0 = dayBoundsLocal(day).start.getTime();
  if (st.getTime() < d0 || st.getTime() >= d0 + 24 * 60 * 60000) return null;
  return {
    startM: st.getHours() * 60 + st.getMinutes(),
    endM: en.getHours() * 60 + en.getMinutes(),
  };
}

/**
 * Couloirs horizontaux : shifts qui se chevauchent sont répartis côte à côte (lanes).
 */
function assignShiftLanes(
  dayShifts: WorkShiftWithDetails[],
  day: Date,
  rangeMinM: number,
  rangeMaxM: number
): Map<string, { lane: number; maxLanes: number }> {
  const items: { id: string; startM: number; endM: number }[] = [];
  for (const s of dayShifts) {
    const b = shiftMinuteBoundsOnDay(s, day);
    if (!b) continue;
    const t0 = Math.max(b.startM, rangeMinM);
    const t1 = Math.min(b.endM, rangeMaxM);
    if (t1 <= t0) continue;
    items.push({ id: s.id, startM: t0, endM: t1 });
  }
  items.sort((a, b) => a.startM - b.startM || a.endM - b.endM);

  const laneEndM: number[] = [];
  const laneById = new Map<string, number>();

  for (const it of items) {
    let L = 0;
    while (L < laneEndM.length && laneEndM[L]! > it.startM) {
      L++;
    }
    if (L === laneEndM.length) {
      laneEndM.push(it.endM);
    } else {
      laneEndM[L] = it.endM;
    }
    laneById.set(it.id, L);
  }

  const maxLanes = Math.max(1, laneEndM.length);
  const out = new Map<string, { lane: number; maxLanes: number }>();
  for (const it of items) {
    const lane = laneById.get(it.id) ?? 0;
    out.set(it.id, { lane, maxLanes });
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
    () => computePlanningWeekTimeRange(shifts, resolvedWeekDays),
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
              <div className="relative min-h-0 h-full">
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
            </div>

            {PLANNING_DAY_KEYS.map((_, di) => {
              const day = weekDays[di];
              const wd = resolvedWeekDays[di];
              const dayShifts = shiftsForCalendarDay(shifts, day);
              const stepM = Math.max(30, Math.min(90, Math.ceil(rangeSpan / 14)));
              const hc = headcountAt(shifts, day, minM, maxM, stepM);
              const laneByShift = assignShiftLanes(dayShifts, day, minM, maxM);

              return (
                <div
                  key={wd.ymd}
                  className={`flex flex-col border-l border-slate-100 ${
                    wd.openingBands.length === 0 ? "bg-rose-50/40" : "bg-slate-50/30"
                  }`}
                  style={{ height: colTotalH }}
                >
                  <div className="relative min-h-0 h-full overflow-hidden">
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

                    {(wd.staffExtraBands ?? []).map((band, bi) => {
                      const p = openingBandPctInRange(day, band.start, band.end, minM, maxM);
                      if (!p) return null;
                      return (
                        <div
                          key={`x-${bi}`}
                          className="pointer-events-none absolute left-0.5 right-0.5 rounded-sm bg-amber-200/55 ring-1 ring-amber-300/40"
                          style={{ top: `${p.top}%`, height: `${Math.max(p.height, 1)}%` }}
                          title={`Travail effectif sans service client ${band.start}–${band.end}`}
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
                          title={`Ouverture au public ${band.start}–${band.end}`}
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
                      const laneInfo = laneByShift.get(s.id);
                      const maxLanes = laneInfo?.maxLanes ?? 1;
                      const lane = laneInfo?.lane ?? 0;
                      const idx = staffColorIndex.get(s.staff_member_id) ?? 0;
                      const layer = STAFF_LAYER_CLASS[idx % STAFF_LAYER_CLASS.length];
                      const br = s.break_minutes != null ? ` · pause ${s.break_minutes} min` : "";
                      const gapPx = 2;
                      const wPct = 100 / maxLanes;
                      const leftPct = (100 * lane) / maxLanes;
                      return (
                        <div
                          key={s.id}
                          className={`absolute z-10 box-border flex items-center justify-center overflow-hidden rounded border border-white/25 ${layer} px-0.5 text-[8px] font-bold leading-tight text-white shadow-sm`}
                          style={{
                            top: `${seg.top}%`,
                            height: `${Math.max(seg.height, 2.5)}%`,
                            minHeight: "10px",
                            left: `calc(${leftPct}% + ${gapPx / 2}px)`,
                            width: `calc(${wPct}% - ${gapPx}px)`,
                          }}
                          title={`${s.staff_display_name} · ${new Date(s.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} – ${new Date(s.ends_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}${br}`}
                        >
                          <span className="truncate">{staffInitials(s.staff_display_name)}</span>
                        </div>
                      );
                    })}

                    {hc.map((n, i) => {
                      const topPct = ((i * stepM) / rangeSpan) * 100;
                      const hPct = (stepM / rangeSpan) * 100;
                      const tStart = minM + i * stepM;
                      const tEnd = Math.min(minM + (i + 1) * stepM, maxM);
                      const labelStart = `${Math.floor(tStart / 60)}h${String(tStart % 60).padStart(2, "0")}`;
                      const labelEnd = `${Math.floor(tEnd / 60)}h${String(tEnd % 60).padStart(2, "0")}`;
                      return (
                        <div
                          key={`hc-${i}`}
                          className="pointer-events-none absolute left-0 right-0 z-30 flex items-start justify-end pr-0.5 pt-px"
                          style={{ top: `${topPct}%`, height: `${hPct}%` }}
                          title={`${labelStart}–${labelEnd} · ${n} présent(s)`}
                        >
                          <span className="rounded bg-white/95 px-0.5 py-px text-[8px] font-bold tabular-nums leading-none text-indigo-800 shadow-sm ring-1 ring-indigo-200/80">
                            {n}
                          </span>
                        </div>
                      );
                    })}
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
            <span className="h-3 w-5 rounded bg-amber-200/90 ring-1 ring-amber-300/50" />
            Travail effectif sans service client (établissement)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-200/80" />
            Effectif présent : chiffre à droite de chaque tranche (même découpage que la grille horaire)
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
