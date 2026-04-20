"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyWeekDeltaToCarryoverAction,
  createSimulationShiftAction,
  createWorkShiftAction,
  updateSimulationShiftTimesAction,
  updateWorkShiftTimesAction,
} from "@/app/equipe/actions";
import { computePlanningWeekTimeRange } from "@/lib/staff/planningGridRange";
import {
  minutesFromMidnight,
  PLANNING_DAY_KEYS,
  PLANNING_DAY_LABELS_FR,
} from "@/lib/staff/planningHoursTypes";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { snapLocalDateToStep } from "@/lib/staff/planningSnap";
import { formatMinutesHuman, netPlannedMinutes } from "@/lib/staff/timeHelpers";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import { addDays, parseISODateLocal } from "@/lib/staff/weekUtils";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiCard, uiInput, uiLabel } from "@/components/ui/premium";

const SNAP_MIN = 15;
/** Même hauteur que la grille « vue semaine ». */
const COL_H = 432;

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

function shiftsForCalendarDay(shifts: WorkShiftWithDetails[], day: Date): WorkShiftWithDetails[] {
  const d0 = dayBounds(day).start.getTime();
  const d1 = d0 + 24 * 60 * 60000;
  return shifts.filter((s) => {
    const a = new Date(s.starts_at).getTime();
    return a >= d0 && a < d1;
  });
}

/** Position du créneau dans [minM, maxM] en % de la colonne. */
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
  const { start: day0 } = dayBounds(day);
  const s = new Date(day0.getTime() + a * 60000);
  const e = new Date(day0.getTime() + b * 60000);
  return segmentPctInRange(s, e, day, rangeMinM, rangeMaxM);
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

/**
 * Couloirs horizontaux : créneaux qui se chevauchent sont côte à côte (lanes).
 * Utilise les horaires « effectifs » (aperçu drag inclus).
 */
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

function toDatetimeLocalValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function snapMinutes(m: number): number {
  return Math.round(m / SNAP_MIN) * SNAP_MIN;
}

/** Affichage court type 09:00 (locale navigateur). */
function formatHm(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatRangeLabel(startIso: string, endIso: string): string {
  return `${formatHm(startIso)} – ${formatHm(endIso)}`;
}

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

type DragMode = "move" | "resize-start" | "resize-end";

type Props = {
  restaurantId: string;
  weekMondayIso: string;
  staff: StaffMember[];
  shifts: WorkShiftWithDetails[];
  resolvedWeekDays: WeekResolvedDay[];
  isSimulation: boolean;
  simulationId: string | null;
  pending: boolean;
  onUpdated: () => void;
};

export function ManualWeekPlanner({
  restaurantId,
  weekMondayIso,
  staff,
  shifts,
  resolvedWeekDays,
  isSimulation,
  simulationId,
  pending,
  onUpdated,
}: Props) {
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

  const staffColor = useMemo(() => {
    const sorted = [...staff].sort((a, b) => a.id.localeCompare(b.id));
    const m = new Map<string, number>();
    sorted.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [staff]);

  const disabled = pending || (isSimulation && !simulationId);

  /** Aperçu pendant glisser / redimensionner. */
  const [preview, setPreview] = useState<Record<string, { start: string; ends: string }>>({});
  /** Bulle d’horaires suivant le pointeur pendant déplacement / redimensionnement. */
  const [dragHud, setDragHud] = useState<null | { x: number; y: number; label: string }>(null);
  const [sheet, setSheet] = useState<null | { mode: "edit"; shiftId: string } | { mode: "create"; staffId: string }>(
    null
  );
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const dragSession = useRef<{
    shiftId: string;
    mode: DragMode;
    anchorY: number;
    origStartMin: number;
    origEndMin: number;
    day: Date;
    rangeSpan: number;
    /** Horaires au début du geste (pour éviter un POST inutile). */
    initialPreview: { start: string; ends: string };
    /** Dernière position (à jour au relâchement, même si React n’a pas encore rendu). */
    lastPreview: { start: string; ends: string };
  } | null>(null);

  const getEffectiveTimes = useCallback(
    (s: WorkShiftWithDetails) => {
      const o = preview[s.id];
      if (o) return { start: o.start, end: o.ends };
      return { start: s.starts_at, end: s.ends_at };
    },
    [preview]
  );

  const commitTimes = useCallback(
    async (shift: WorkShiftWithDetails, startIso: string, endIso: string): Promise<boolean> => {
      const start = new Date(startIso);
      const end = new Date(endIso);
      const sLocal = toDatetimeLocalValue(start);
      const eLocal = toDatetimeLocalValue(end);
      let r: { ok: true } | { ok: false; error: string };
      if (isSimulation) {
        if (!simulationId) return false;
        r = await updateSimulationShiftTimesAction(restaurantId, shift.id, {
          startsAtLocal: sLocal,
          endsAtLocal: eLocal,
        });
      } else {
        r = await updateWorkShiftTimesAction(restaurantId, shift.id, {
          startsAtLocal: sLocal,
          endsAtLocal: eLocal,
        });
      }
      if (!r.ok) {
        setErr(r.error);
        setPreview((prev) => {
          const n = { ...prev };
          delete n[shift.id];
          return n;
        });
        return false;
      }
      setPreview((prev) => {
        const n = { ...prev };
        delete n[shift.id];
        return n;
      });
      setErr(null);
      onUpdated();
      return true;
    },
    [restaurantId, isSimulation, simulationId, onUpdated]
  );

  const beginDrag = useCallback(
    (
      e: React.PointerEvent,
      shift: WorkShiftWithDetails,
      day: Date,
      mode: DragMode
    ) => {
      if (pending) return;
      e.preventDefault();
      e.stopPropagation();
      const eff = getEffectiveTimes(shift);
      const st = new Date(eff.start);
      const en = new Date(eff.end);
      const d0 = dayBounds(day).start;
      const origStartMin = (st.getTime() - d0.getTime()) / 60000;
      const origEndMin = (en.getTime() - d0.getTime()) / 60000;
      const initialPreview = { start: eff.start, ends: eff.end };

      dragSession.current = {
        shiftId: shift.id,
        mode,
        anchorY: e.clientY,
        origStartMin,
        origEndMin,
        day,
        rangeSpan,
        initialPreview,
        lastPreview: initialPreview,
      };

      setDragHud({
        x: e.clientX,
        y: e.clientY,
        label: formatRangeLabel(initialPreview.start, initialPreview.ends),
      });

      const onMove = (ev: PointerEvent) => {
        const d = dragSession.current;
        if (!d) return;
        const deltaMin = ((ev.clientY - d.anchorY) / COL_H) * d.rangeSpan;
        let ns = d.origStartMin;
        let ne = d.origEndMin;
        if (d.mode === "move") {
          ns = snapMinutes(d.origStartMin + deltaMin);
          ne = snapMinutes(d.origEndMin + deltaMin);
        } else if (d.mode === "resize-start") {
          ns = snapMinutes(d.origStartMin + deltaMin);
          ns = Math.max(0, Math.min(ns, ne - SNAP_MIN));
        } else {
          ne = snapMinutes(d.origEndMin + deltaMin);
          ne = Math.min(24 * 60, Math.max(ne, ns + SNAP_MIN));
        }
        const day0 = dayBounds(d.day).start;
        const startD = new Date(day0.getTime() + ns * 60000);
        const endD = new Date(day0.getTime() + ne * 60000);
        const sSnap = snapLocalDateToStep(startD, SNAP_MIN);
        const eSnap = snapLocalDateToStep(endD, SNAP_MIN);
        if (!(eSnap > sSnap)) return;
        const next = { start: sSnap.toISOString(), ends: eSnap.toISOString() };
        if (dragSession.current) dragSession.current.lastPreview = next;
        setDragHud({
          x: ev.clientX,
          y: ev.clientY,
          label: formatRangeLabel(next.start, next.ends),
        });
        setPreview((prev) => ({
          ...prev,
          [shift.id]: next,
        }));
      };

      const onUp = async () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        setDragHud(null);
        const sess = dragSession.current;
        dragSession.current = null;
        const sh = shifts.find((x) => x.id === shift.id);
        if (!sess || !sh) {
          setPreview((prev) => {
            const n = { ...prev };
            delete n[shift.id];
            return n;
          });
          return;
        }
        const { lastPreview, initialPreview } = sess;
        const unchanged =
          lastPreview.start === initialPreview.start && lastPreview.ends === initialPreview.ends;
        if (unchanged) {
          setPreview((prev) => {
            const n = { ...prev };
            delete n[shift.id];
            return n;
          });
          return;
        }
        await commitTimes(sh, lastPreview.start, lastPreview.ends);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [pending, getEffectiveTimes, shifts, commitTimes, rangeSpan]
  );

  function openEditShift(s: WorkShiftWithDetails) {
    const eff = getEffectiveTimes(s);
    setFormStart(toDatetimeLocalValue(new Date(eff.start)));
    setFormEnd(toDatetimeLocalValue(new Date(eff.end)));
    setSheet({ mode: "edit", shiftId: s.id });
    setErr(null);
  }

  function openCreateSlot(day: Date) {
    const d0 = dayBounds(day).start;
    const s = new Date(d0);
    s.setHours(9, 0, 0, 0);
    const e = new Date(d0);
    e.setHours(13, 0, 0, 0);
    setFormStart(toDatetimeLocalValue(s));
    setFormEnd(toDatetimeLocalValue(e));
    setSheet({ mode: "create", staffId: staff[0]?.id ?? "" });
    setErr(null);
  }

  async function saveSheet() {
    if (!sheet) return;
    if (sheet.mode === "create") {
      if (disabled) return;
      if (!sheet.staffId.trim()) {
        setErr("Choisissez un collaborateur.");
        return;
      }
      let r: { ok: true; id: string } | { ok: false; error: string };
      if (isSimulation) {
        if (!simulationId) return;
        r = await createSimulationShiftAction(restaurantId, simulationId, {
          staffMemberId: sheet.staffId,
          startsAtLocal: formStart,
          endsAtLocal: formEnd,
        });
      } else {
        r = await createWorkShiftAction(restaurantId, {
          staffMemberId: sheet.staffId,
          startsAtLocal: formStart,
          endsAtLocal: formEnd,
        });
      }
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setErr(null);
      setSheet(null);
      onUpdated();
      return;
    }
    const s = shifts.find((x) => x.id === sheet.shiftId);
    if (!s) return;
    const ok = await commitTimes(s, new Date(formStart).toISOString(), new Date(formEnd).toISOString());
    if (ok) setSheet(null);
  }

  if (!monday || weekDays.length === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        <strong className="text-slate-800">Planning manuel</strong> : glisser le bloc pour déplacer, tirer le haut ou le
        bas pour ajuster (pas de 15 min) — les horaires s’affichent sur le bloc et dans une bulle pendant le geste.
        Double-clic pour saisir les horaires. « + Créneau » sous chaque jour : choisir le collaborateur dans la fenêtre.
        Les créneaux qui se chevauchent sont côte à côte, comme sur la vue semaine.
      </p>
      {err ? <p className="text-sm text-rose-700">{err}</p> : null}

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
                  {wd.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </div>
                {wd.openingBands.length === 0 ? (
                  <div className="text-[10px] font-medium text-rose-700">Fermé</div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: `3rem repeat(7, minmax(0,1fr))` }}>
            <div
              className="flex flex-col border-r border-slate-200 bg-slate-50/80"
              style={{ height: COL_H }}
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
              const day = weekDays[di]!;
              const wd = resolvedWeekDays[di]!;
              const dayShifts = shiftsForCalendarDay(shifts, day);
              const stepM = Math.max(30, Math.min(90, Math.ceil(rangeSpan / 14)));
              const hc = headcountAt(shifts, day, minM, maxM, stepM);
              const laneByShift = assignShiftLanesForDay(
                dayShifts,
                day,
                minM,
                maxM,
                (s) => {
                  const e = getEffectiveTimes(s);
                  return { start: e.start, end: e.end };
                }
              );

              return (
                <div
                  key={wd.ymd}
                  className={`flex flex-col border-l border-slate-100 ${
                    wd.openingBands.length === 0 ? "bg-rose-50/40" : "bg-slate-50/30"
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
                      const eff = getEffectiveTimes(s);
                      const seg = segmentPctInRange(
                        new Date(eff.start),
                        new Date(eff.end),
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
                      const layer = STAFF_LAYER_CLASS[idx % STAFF_LAYER_CLASS.length];
                      const br = s.break_minutes != null ? ` · pause ${s.break_minutes} min` : "";
                      return (
                        <div
                          key={s.id}
                          className={`absolute z-20 box-border flex flex-col items-center justify-center overflow-hidden rounded border border-white/25 ${layer} px-0.5 text-white shadow-sm ${
                            disabled ? "opacity-50" : ""
                          }`}
                          style={{
                            top: `${seg.top}%`,
                            height: `${Math.max(seg.height, 2.5)}%`,
                            minHeight: "10px",
                            left: `calc(${leftPct}% + ${gapPx / 2}px)`,
                            width: `calc(${wPct}% - ${gapPx}px)`,
                          }}
                          title={`${s.staff_display_name} · ${formatRangeLabel(eff.start, eff.end)}${br} · double-clic pour éditer`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (!disabled) openEditShift(s);
                          }}
                        >
                          <div className="pointer-events-none flex min-h-0 w-full flex-col items-center justify-center gap-0.5 px-0.5 text-center">
                            <span className="w-full truncate text-[8px] font-bold leading-none drop-shadow-sm">
                              {staffInitials(s.staff_display_name)}
                            </span>
                            <span className="w-full truncate text-[7px] font-semibold leading-tight opacity-95 drop-shadow-sm">
                              {formatRangeLabel(eff.start, eff.end)}
                            </span>
                          </div>
                          <div
                            className="absolute left-0 right-0 top-0 z-30 h-2 cursor-ns-resize hover:bg-white/25"
                            onPointerDown={(e) => {
                              if (disabled) return;
                              e.stopPropagation();
                              beginDrag(e, s, day, "resize-start");
                            }}
                          />
                          <div
                            className="absolute inset-x-0 top-2 bottom-2 z-30 cursor-grab active:cursor-grabbing"
                            onPointerDown={(e) => {
                              if (disabled) return;
                              e.stopPropagation();
                              beginDrag(e, s, day, "move");
                            }}
                          />
                          <div
                            className="absolute bottom-0 left-0 right-0 z-30 h-2 cursor-ns-resize hover:bg-white/25"
                            onPointerDown={(e) => {
                              if (disabled) return;
                              e.stopPropagation();
                              beginDrag(e, s, day, "resize-end");
                            }}
                          />
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
                          className="pointer-events-none absolute left-0 right-0 z-40 flex items-start justify-end pr-0.5 pt-px"
                          style={{ top: `${topPct}%`, height: `${hPct}%` }}
                          title={`${labelStart}–${labelEnd} · ${n} présent(s)`}
                        >
                          <span className="rounded bg-white/95 px-0.5 py-px text-[8px] font-bold tabular-nums leading-none text-indigo-800 shadow-sm ring-1 ring-indigo-200/80">
                            {n}
                          </span>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      disabled={disabled || staff.length === 0}
                      className="absolute bottom-1 left-1/2 z-[35] -translate-x-1/2 rounded-md border border-slate-200/90 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur-[2px] hover:bg-white disabled:pointer-events-none disabled:opacity-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreateSlot(day);
                      }}
                    >
                      + Créneau
                    </button>
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
            Travail sans service client
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {staff.map((m) => {
            const idx = staffColor.get(m.id) ?? 0;
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

      {sheet ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
          <div className={`${uiCard} w-full max-w-md shadow-xl`}>
            <h3 className="text-sm font-semibold text-slate-900">
              {sheet.mode === "create" ? "Nouveau créneau" : "Modifier le créneau"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Pas de 15 minutes.</p>
            {sheet.mode === "create" ? (
              <div className="mt-3">
                <label className={uiLabel} htmlFor="man-staff">
                  Collaborateur
                </label>
                <select
                  id="man-staff"
                  className={`${uiInput} mt-1 w-full`}
                  value={sheet.staffId}
                  onChange={(e) => setSheet({ mode: "create", staffId: e.target.value })}
                >
                  {staff.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={uiLabel} htmlFor="man-start">
                  Début
                </label>
                <input
                  id="man-start"
                  type="datetime-local"
                  step={900}
                  className={`${uiInput} mt-1 w-full`}
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                />
              </div>
              <div>
                <label className={uiLabel} htmlFor="man-end">
                  Fin
                </label>
                <input
                  id="man-end"
                  type="datetime-local"
                  step={900}
                  className={`${uiInput} mt-1 w-full`}
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={() => void saveSheet()}>
                {sheet.mode === "create" ? "Créer" : "Enregistrer"}
              </button>
              <button type="button" className={uiBtnOutlineSm} onClick={() => setSheet(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dragHud ? (
        <div
          className="pointer-events-none fixed z-[200] max-w-[min(100vw-1rem,14rem)] rounded-md border border-white/25 bg-slate-900/95 px-2.5 py-1.5 text-center text-xs font-semibold tabular-nums text-white shadow-lg"
          style={{
            left: dragHud.x,
            top: dragHud.y,
            transform: "translate(10px, calc(-100% - 8px))",
          }}
        >
          {dragHud.label}
        </div>
      ) : null}
    </div>
  );
}

/** Récap heures / contrat / solde (planning réel uniquement pour le report). */
export function PlanningHoursRecap({
  staff,
  shifts,
  weekMondayIso,
  restaurantId,
  pending,
  onUpdated,
  showCarryoverActions,
}: {
  staff: StaffMember[];
  shifts: WorkShiftWithDetails[];
  weekMondayIso: string;
  restaurantId: string;
  pending: boolean;
  onUpdated: () => void;
  showCarryoverActions: boolean;
}) {
  const monday = useMemo(() => parseISODateLocal(weekMondayIso), [weekMondayIso]);
  const weekEnd = useMemo(() => (monday ? addDays(monday, 7) : null), [monday]);

  const byStaff = useMemo(() => {
    const t0 = monday?.getTime() ?? 0;
    const t1 = weekEnd?.getTime() ?? 0;
    const m = new Map<string, number>();
    for (const s of staff) m.set(s.id, 0);
    for (const sh of shifts) {
      const a = new Date(sh.starts_at).getTime();
      if (a < t0 || a >= t1) continue;
      const net = netPlannedMinutes(sh.starts_at, sh.ends_at, sh.break_minutes);
      m.set(sh.staff_member_id, (m.get(sh.staff_member_id) ?? 0) + net);
    }
    return m;
  }, [staff, shifts, monday, weekEnd]);

  const [msg, setMsg] = useState<string | null>(null);

  async function applyDelta() {
    setMsg(null);
    const r = await applyWeekDeltaToCarryoverAction(restaurantId, weekMondayIso);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setMsg(`Solde mis à jour pour ${r.updated} collaborateur(s) avec objectif horaire.`);
    onUpdated();
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase text-slate-500">
              <th className="px-3 py-2">Collaborateur</th>
              <th className="px-3 py-2">Prévu net (sem.)</th>
              <th className="px-3 py-2">Contrat (h/sem.)</th>
              <th className="px-3 py-2">Δ vs contrat</th>
              <th className="px-3 py-2">Solde report</th>
              <th className="px-3 py-2">Après report*</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((m) => {
              const planned = byStaff.get(m.id) ?? 0;
              const target = m.target_weekly_hours;
              const targetMin =
                target != null && Number.isFinite(target) && target > 0 ? Math.round(target * 60) : null;
              const delta = targetMin != null ? planned - targetMin : null;
              const carry = m.planning_carryover_minutes ?? 0;
              const after = targetMin != null ? carry + (targetMin - planned) : carry;
              return (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{m.display_name}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{formatMinutesHuman(planned)}</td>
                  <td className="px-3 py-2 text-slate-600">{target != null ? `${target} h` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">
                    {delta == null ? "—" : formatMinutesHuman(delta)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{formatMinutesHuman(carry)}</td>
                  <td className="px-3 py-2 tabular-nums text-indigo-800">
                    {targetMin == null ? "—" : formatMinutesHuman(after)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-snug text-slate-500">
        * « Après report » = solde actuel + (contrat − prévu net). Le bouton enregistre cette différence dans le solde
        (report). Évitez de l’appliquer deux fois pour la même semaine.
      </p>
      {showCarryoverActions ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={applyDelta}>
            Incorporer l’écart de cette semaine au solde
          </button>
          {msg ? <span className="text-xs text-emerald-800">{msg}</span> : null}
        </div>
      ) : (
        <p className="text-xs text-amber-800">Passez en planning réel pour ajuster le solde d’heures.</p>
      )}
    </div>
  );
}
