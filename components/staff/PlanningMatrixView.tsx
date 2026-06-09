"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { PLANNING_DAY_KEYS, PLANNING_DAY_LABELS_FR, minutesFromMidnight } from "@/lib/staff/planningHoursTypes";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { STAFF_COLOR_HEX, resolveStaffColorIndex } from "@/lib/staff/staffColors";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";

const SLOT_STEP = 30;
const DEFAULT_START = 9 * 60 + 30; // 09:30
const DEFAULT_END = 23 * 60; // 23:00

type Props = {
  shifts: WorkShiftWithDetails[];
  staff: StaffMember[];
  resolvedWeekDays: WeekResolvedDay[];
  securityFloor: number;
};

type DayCell = { memberId: string; startMin: number; endMin: number };

function localMinutes(iso: string): { ymd: string; min: number } {
  const d = new Date(iso);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return { ymd, min: d.getHours() * 60 + d.getMinutes() };
}

function fmtSlot(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Vue matrice inversée (OBJECTIF 3) : tranches horaires (30 min) en lignes,
 * membres de l'équipe en colonnes, dernière colonne « Total Présence »
 * (rouge vif sous le talon de sécurité pendant l'ouverture).
 */
export function PlanningMatrixView({ shifts, staff, resolvedWeekDays, securityFloor }: Props) {
  const [dayIdx, setDayIdx] = useState<number>(() => {
    const todayYmd = new Date().toISOString().slice(0, 10);
    const i = resolvedWeekDays.findIndex((d) => d.ymd === todayYmd);
    return i >= 0 ? i : 0;
  });

  const day = resolvedWeekDays[dayIdx] ?? resolvedWeekDays[0];
  const allStaffIds = useMemo(() => staff.map((s) => s.id), [staff]);

  // Colonnes : membres ayant ≥ 1 créneau dans la semaine (stable d'un jour à l'autre).
  const columns = useMemo(() => {
    const ids = new Set(shifts.map((s) => s.staff_member_id));
    return staff
      .filter((s) => ids.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.display_name,
        color: STAFF_COLOR_HEX[resolveStaffColorIndex(s.id, s.color_index, allStaffIds)],
      }));
  }, [shifts, staff, allStaffIds]);

  // Créneaux du jour sélectionné, normalisés en minutes locales.
  const dayCells: DayCell[] = useMemo(() => {
    if (!day) return [];
    const out: DayCell[] = [];
    for (const s of shifts) {
      const a = localMinutes(s.starts_at);
      const b = localMinutes(s.ends_at);
      if (a.ymd !== day.ymd) continue;
      out.push({ memberId: s.staff_member_id, startMin: a.min, endMin: b.min });
    }
    return out;
  }, [shifts, day]);

  // Plages d'ouverture du jour (pour savoir si un slot est "pendant l'ouverture").
  const openingIntervals = useMemo(() => {
    if (!day) return [] as [number, number][];
    const iv: [number, number][] = [];
    for (const b of day.openingBands) {
      const a = minutesFromMidnight(b.start);
      const e = minutesFromMidnight(b.end);
      if (a != null && e != null && e > a) iv.push([a, e]);
    }
    return iv;
  }, [day]);

  const isOpen = (min: number) => openingIntervals.some(([a, e]) => min >= a && min < e);

  // Bornes de la grille : ouverture + créneaux du jour, sinon défaut 09:30–23:00.
  const { gridStart, gridEnd } = useMemo(() => {
    let lo = DEFAULT_START;
    let hi = DEFAULT_END;
    let any = false;
    for (const [a, e] of openingIntervals) {
      lo = any ? Math.min(lo, a) : a;
      hi = any ? Math.max(hi, e) : e;
      any = true;
    }
    for (const c of dayCells) {
      lo = any ? Math.min(lo, c.startMin) : c.startMin;
      hi = any ? Math.max(hi, c.endMin) : c.endMin;
      any = true;
    }
    if (!any) return { gridStart: DEFAULT_START, gridEnd: DEFAULT_END };
    lo = Math.floor(lo / SLOT_STEP) * SLOT_STEP;
    hi = Math.ceil(hi / SLOT_STEP) * SLOT_STEP;
    return { gridStart: lo, gridEnd: hi };
  }, [openingIntervals, dayCells]);

  const slots = useMemo(() => {
    const out: number[] = [];
    for (let m = gridStart; m < gridEnd; m += SLOT_STEP) out.push(m);
    return out;
  }, [gridStart, gridEnd]);

  const floor = Math.max(2, Math.round(securityFloor));

  function presenceAt(min: number): number {
    let n = 0;
    for (const c of dayCells) if (min >= c.startMin && min < c.endMin) n += 1;
    return n;
  }
  function memberOnAt(memberId: string, min: number): boolean {
    return dayCells.some((c) => c.memberId === memberId && min >= c.startMin && min < c.endMin);
  }

  const understaffedCount = slots.filter((m) => isOpen(m) && presenceAt(m) < floor).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {resolvedWeekDays.map((d, i) => {
          const closed = d.openingBands.length === 0;
          return (
            <button
              key={d.ymd}
              type="button"
              onClick={() => setDayIdx(i)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                i === dayIdx
                  ? "bg-slate-900 text-white"
                  : closed
                    ? "bg-slate-100 text-slate-400"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {PLANNING_DAY_LABELS_FR[PLANNING_DAY_KEYS[i]]} {Number(d.ymd.slice(8, 10))}
            </button>
          );
        })}
      </div>

      {understaffedCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {understaffedCount} tranche(s) sous le talon de sécurité ({floor}) pendant l&apos;ouverture.
        </div>
      )}

      {columns.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          Aucun créneau planifié sur cette semaine.
        </p>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-600">
                  Heure
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    className="border-b border-r border-slate-200 px-1 py-2 text-center font-semibold text-slate-700"
                    style={{ minWidth: 64 }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: c.color }}
                    />{" "}
                    <span className="align-middle">{c.name}</span>
                  </th>
                ))}
                <th className="border-b border-slate-200 bg-slate-100 px-2 py-2 text-center font-semibold text-slate-700">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {slots.map((min) => {
                const total = presenceAt(min);
                const open = isOpen(min);
                const breach = open && total < floor;
                return (
                  <tr key={min} className={open ? "" : "bg-slate-50/60"}>
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-500">
                      {fmtSlot(min)}
                    </td>
                    {columns.map((c) => {
                      const on = memberOnAt(c.id, min);
                      return (
                        <td key={c.id} className="border-r border-slate-100 p-0">
                          <div
                            className="h-5 w-full"
                            style={on ? { backgroundColor: c.color, opacity: 0.85 } : undefined}
                            title={on ? `${c.name} — ${fmtSlot(min)}` : undefined}
                          />
                        </td>
                      );
                    })}
                    <td
                      className={`px-2 py-1 text-center font-semibold tabular-nums ${
                        breach
                          ? "bg-red-500 text-white"
                          : open
                            ? total >= floor
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-slate-700"
                            : "text-slate-400"
                      }`}
                    >
                      {breach ? (
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {total}
                        </span>
                      ) : (
                        total
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
