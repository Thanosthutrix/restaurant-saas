"use client";

import { useMemo } from "react";
import { computePlanningWeekTimeRange } from "@/lib/staff/planningGridRange";
import { PLANNING_DAY_KEYS, PLANNING_DAY_LABELS_FR } from "@/lib/staff/planningHoursTypes";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import { buildStaffInitialsByMemberId, staffInitialsBase } from "@/lib/staff/staffDisplayInitials";
import { STAFF_COLORS, resolveStaffColorIndex } from "@/lib/staff/staffColors";
import { addDays, parseISODateLocal } from "@/lib/staff/weekUtils";

const COL_H = 432;
const COL_WIDTH_SCALE = 0.7;

const STAFF_LAYER_CLASS = STAFF_COLORS;

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function shiftsForCalendarDay(shifts: WorkShiftWithDetails[], day: Date): WorkShiftWithDetails[] {
  const d0 = dayBounds(day).start.getTime();
  const d1 = d0 + 24 * 60 * 60000;
  return shifts.filter((s) => {
    const a = new Date(s.starts_at).getTime();
    return a >= d0 && a < d1;
  });
}

function segmentPctInRange(
  shiftStart: Date,
  shiftEnd: Date,
  day: Date,
  rangeMinM: number,
  rangeMaxM: number
): { top: number; height: number } | null {
  const { start: day0 } = dayBounds(day);
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

function shiftMinuteBoundsOnDayStrings(
  startIso: string,
  endIso: string,
  day: Date
): { startM: number; endM: number } | null {
  const st = new Date(startIso);
  const en = new Date(endIso);
  if (st.toDateString() !== en.toDateString()) return null;
  const d0 = dayBounds(day).start.getTime();
  if (st.getTime() < d0 || st.getTime() >= d0 + 24 * 60 * 60000) return null;
  return {
    startM: st.getHours() * 60 + st.getMinutes(),
    endM: en.getHours() * 60 + en.getMinutes(),
  };
}

function assignShiftLanesForDay(
  dayShifts: WorkShiftWithDetails[],
  day: Date,
  rangeMinM: number,
  rangeMaxM: number,
  effectiveBounds: (s: WorkShiftWithDetails) => { start: string; end: string }
): Map<string, { lane: number; maxLanes: number }> {
  const items: { id: string; startM: number; endM: number }[] = [];
  for (const s of dayShifts) {
    const { start: st, end: en } = effectiveBounds(s);
    const b = shiftMinuteBoundsOnDayStrings(st, en, day);
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

function formatHm(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatRangeLabel(startIso: string, endIso: string): string {
  return `${formatHm(startIso)} – ${formatHm(endIso)}`;
}

type Props = {
  weekMondayIso: string;
  staff: StaffMember[];
  shifts: WorkShiftWithDetails[];
  resolvedWeekDays: WeekResolvedDay[];
};

export function PlanningWeekReadOnly({ weekMondayIso, staff, shifts, resolvedWeekDays }: Props) {
  const monday = useMemo(() => parseISODateLocal(weekMondayIso), [weekMondayIso]);
  const weekDays = useMemo(() => {
    if (!monday) return [];
    return PLANNING_DAY_KEYS.map((_, i) => addDays(monday, i));
  }, [monday]);

  const { minM, maxM } = useMemo(
    () => computePlanningWeekTimeRange(shifts, resolvedWeekDays),
    [shifts, resolvedWeekDays]
  );
  const rangeSpan = Math.max(1, maxM - minM);

  const hourTicks = useMemo(() => {
    const ticks: number[] = [];
    const startH = Math.floor(minM / 60);
    const endH = Math.ceil(maxM / 60);
    for (let h = startH; h <= endH; h++) ticks.push(h);
    return ticks;
  }, [minM, maxM]);

  const visibleDayIndices = useMemo(() => {
    if (resolvedWeekDays.length !== 7) return [] as number[];
    return PLANNING_DAY_KEYS.map((_, i) => i);
  }, [resolvedWeekDays.length]);

  const dayColumnWeights = useMemo(() => {
    if (weekDays.length !== 7) return [];
    const stepM = Math.max(30, Math.min(90, Math.ceil(rangeSpan / 14)));
    return visibleDayIndices.map((di) => {
      const day = weekDays[di]!;
      const dayShifts = shiftsForCalendarDay(shifts, day);
      const hc = headcountAt(shifts, day, minM, maxM, stepM);
      const peakHc = hc.length ? Math.max(...hc) : 0;
      const laneMap = assignShiftLanesForDay(
        dayShifts,
        day,
        minM,
        maxM,
        (s) => ({ start: s.starts_at, end: s.ends_at })
      );
      let maxLanes = 1;
      for (const v of laneMap.values()) {
        maxLanes = Math.max(maxLanes, v.maxLanes);
      }
      return Math.max(1, peakHc, maxLanes);
    });
  }, [weekDays, shifts, minM, maxM, rangeSpan, visibleDayIndices]);

  const gridColsTemplate = useMemo(() => {
    if (dayColumnWeights.length === 0) return "3rem";
    const parts = dayColumnWeights.map((w) => {
      const minPx = Math.round((72 + w * 40) * COL_WIDTH_SCALE);
      const fr = Math.pow(Math.max(1, w), 1.35);
      return `minmax(${minPx}px, ${fr.toFixed(2)}fr)`;
    });
    return `3rem ${parts.join(" ")}`;
  }, [dayColumnWeights]);

  const gridMinWidthPx = useMemo(() => {
    const timeCol = 48;
    const daysMin = dayColumnWeights.reduce(
      (acc, w) => acc + Math.round((72 + w * 40) * COL_WIDTH_SCALE),
      0
    );
    return timeCol + daysMin + 16;
  }, [dayColumnWeights]);

  const staffColor = useMemo(() => {
    const allIds = staff.map((s) => s.id);
    const m = new Map<string, number>();
    staff.forEach((s) => m.set(s.id, resolveStaffColorIndex(s.id, s.color_index, allIds)));
    return m;
  }, [staff]);

  const initialsById = useMemo(() => buildStaffInitialsByMemberId(staff), [staff]);

  if (!monday || resolvedWeekDays.length !== 7) {
    return (
      <p className="text-sm text-slate-500">Semaine non disponible.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-0" style={{ minWidth: gridMinWidthPx }}>
        <div
          className="grid border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"
          style={{ gridTemplateColumns: gridColsTemplate }}
        >
          <div className="px-1 py-2 text-center text-[10px] leading-tight text-slate-500">Heures</div>
          {visibleDayIndices.map((di) => {
            const wd = resolvedWeekDays[di]!;
            return (
              <div
                key={wd.ymd}
                className="border-l-2 border-slate-200 bg-slate-50/90 px-1 py-2 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]"
              >
                {PLANNING_DAY_LABELS_FR[wd.dayKey]}
                <div className="font-normal text-[10px] text-slate-400">
                  {wd.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </div>
                {wd.openingBands.length === 0 ? (
                  <div className="text-[10px] font-medium text-rose-700">Fermé</div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: gridColsTemplate }}>
          <div className="flex flex-col border-r-2 border-slate-200 bg-slate-50/80" style={{ height: COL_H }}>
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

          {visibleDayIndices.map((di) => {
            const day = weekDays[di]!;
            const wd = resolvedWeekDays[di]!;
            const dayShifts = shiftsForCalendarDay(shifts, day);
            const laneByShift = assignShiftLanesForDay(
              dayShifts,
              day,
              minM,
              maxM,
              (s) => ({ start: s.starts_at, end: s.ends_at })
            );

            return (
              <div
                key={wd.ymd}
                className={`flex flex-col border-l-2 border-slate-200 ${
                  wd.openingBands.length === 0 ? "bg-rose-50/50" : "bg-slate-50/40"
                }`}
                style={{ height: COL_H }}
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
                    const gapPx = 2;
                    const wPct = 100 / maxLanes;
                    const leftPct = (100 * lane) / maxLanes;
                    const idx = staffColor.get(s.staff_member_id) ?? 0;
                    const layer = STAFF_LAYER_CLASS[idx % STAFF_LAYER_CLASS.length]!;
                    const br = s.break_minutes != null ? ` · pause ${s.break_minutes} min` : "";
                    return (
                      <div
                        key={s.id}
                        className={`absolute z-20 box-border flex flex-col items-center justify-center overflow-hidden rounded border border-white/25 ${layer} px-0.5 text-white shadow-sm`}
                        style={{
                          top: `${seg.top}%`,
                          height: `${Math.max(seg.height, 2.5)}%`,
                          minHeight: "10px",
                          left: `calc(${leftPct}% + ${gapPx / 2}px)`,
                          width: `calc(${wPct}% - ${gapPx}px)`,
                        }}
                        title={`${s.staff_display_name} · ${formatRangeLabel(s.starts_at, s.ends_at)}${br}`}
                      >
                        <div className="pointer-events-none flex min-h-0 w-full flex-col items-center justify-center gap-0.5 px-0.5 py-0.5 text-center">
                          <span className="w-full truncate text-[8px] font-bold leading-none drop-shadow-sm">
                            {initialsById.get(s.staff_member_id) ?? staffInitialsBase(s.staff_display_name)}
                          </span>
                          <span className="w-full truncate text-[7px] font-semibold leading-tight opacity-95 drop-shadow-sm">
                            {formatRangeLabel(s.starts_at, s.ends_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="border-t border-slate-100 px-3 py-2 text-center text-[11px] text-slate-500">
        Vue équipe en lecture seule — les horaires sont gérés par le responsable sur « Équipe & planning ».
      </p>
    </div>
  );
}
