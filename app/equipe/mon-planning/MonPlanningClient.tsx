"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PlanningWeekReadOnly } from "@/components/staff/PlanningWeekReadOnly";
import { findPendingArrival, findPendingClockOut, formatMyShiftLineFr } from "@/lib/staff/dayClock";
import type { PlanningDayOverrideRow } from "@/lib/staff/planningResolve";
import { resolveWeekPlanningDays } from "@/lib/staff/planningResolve";
import type { OpeningHoursMap, PlanningDayKey } from "@/lib/staff/planningHoursTypes";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import { actualDurationMinutes, formatMinutesHuman, netPlannedMinutes } from "@/lib/staff/timeHelpers";
import { addDays, mondayOfWeekContaining, parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";
import { clockInAction, clockOutAction } from "../actions";
import { uiBtnPrimarySm, uiCard } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  weekMondayIso: string;
  prevWeekYmd: string;
  nextWeekYmd: string;
  allShifts: WorkShiftWithDetails[];
  myShifts: WorkShiftWithDetails[];
  staff: StaffMember[];
  planningOpeningHours: OpeningHoursMap;
  planningStaffExtraBands: OpeningHoursMap;
  planningStaffTargetsWeekly: Partial<Record<PlanningDayKey, number>>;
  planningDayOverrides: PlanningDayOverrideRow[];
};

export function MonPlanningClient({
  restaurantId,
  weekMondayIso,
  prevWeekYmd,
  nextWeekYmd,
  allShifts,
  myShifts,
  staff,
  planningOpeningHours,
  planningStaffExtraBands,
  planningStaffTargetsWeekly,
  planningDayOverrides,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const monday = useMemo(() => parseISODateLocal(weekMondayIso), [weekMondayIso]);

  const resolvedWeekDaysForGrid = useMemo(() => {
    const m = parseISODateLocal(weekMondayIso);
    if (!m) return [];
    return resolveWeekPlanningDays(
      m,
      planningOpeningHours,
      planningStaffExtraBands,
      planningStaffTargetsWeekly,
      planningDayOverrides
    );
  }, [
    weekMondayIso,
    planningOpeningHours,
    planningStaffExtraBands,
    planningStaffTargetsWeekly,
    planningDayOverrides,
  ]);

  const pendingClockOutShift = useMemo(() => findPendingClockOut(myShifts), [myShifts]);

  const pendingArrivalShift = useMemo(() => {
    if (pendingClockOutShift) return null;
    return findPendingArrival(myShifts, new Date());
  }, [myShifts, pendingClockOutShift]);

  const recap = useMemo(() => {
    let plannedNet = 0;
    let recordedNet = 0;
    for (const s of myShifts) {
      plannedNet += netPlannedMinutes(s.starts_at, s.ends_at, s.break_minutes);
      const act = actualDurationMinutes(
        s.attendance?.clock_in_at ?? null,
        s.attendance?.clock_out_at ?? null
      );
      if (act != null) recordedNet += act;
    }
    return { plannedNet, recordedNet };
  }, [myShifts]);

  function refresh() {
    router.refresh();
  }

  function clockIn(shiftId: string) {
    setError(null);
    start(async () => {
      const r = await clockInAction(restaurantId, shiftId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  function clockOut(shiftId: string) {
    setError(null);
    start(async () => {
      const r = await clockOutAction(restaurantId, shiftId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  const weekLabel = monday
    ? (() => {
        const sun = addDays(monday, 6);
        const a = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        const b = sun.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
        return `${a} – ${b}`;
      })()
    : "";

  const showEndOfDayBar = Boolean(pendingClockOutShift);

  return (
    <div className={`space-y-8 ${showEndOfDayBar ? "pb-28" : ""}`}>
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-slate-800">Semaine du {weekLabel}</p>
        <div className="flex items-center gap-2">
          <Link
            href={`/equipe/mon-planning?week=${encodeURIComponent(prevWeekYmd)}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ← Semaine précédente
          </Link>
          <Link
            href={`/equipe/mon-planning?week=${encodeURIComponent(nextWeekYmd)}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Semaine suivante →
          </Link>
          <Link
            href={`/equipe/mon-planning?week=${encodeURIComponent(toISODateString(mondayOfWeekContaining(new Date())))}`}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100"
          >
            Cette semaine
          </Link>
        </div>
      </div>

      {pendingArrivalShift && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 shadow-sm">
          <p className="text-sm text-slate-700">
            Créneau prévu :{" "}
            <span className="font-medium text-slate-900">
              {formatMyShiftLineFr(pendingArrivalShift.starts_at, pendingArrivalShift.ends_at)}
            </span>
          </p>
          <button
            type="button"
            disabled={pending}
            className={`mt-4 ${uiBtnPrimarySm} px-5 py-2.5 text-base`}
            onClick={() => clockIn(pendingArrivalShift.id)}
          >
            Je démarre ma journée
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Planning de l’équipe</h2>
        {resolvedWeekDaysForGrid.length === 7 ? (
          <PlanningWeekReadOnly
            weekMondayIso={weekMondayIso}
            staff={staff}
            shifts={allShifts}
            resolvedWeekDays={resolvedWeekDaysForGrid}
          />
        ) : (
          <p className="text-sm text-slate-500">Chargement de la grille…</p>
        )}
      </section>

      <section className={`${uiCard} space-y-3`}>
        <h2 className="text-lg font-semibold text-slate-900">Mon récapitulatif (cette semaine)</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Prévu (net, pauses déduites)</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {formatMinutesHuman(recap.plannedNet)}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Temps enregistré (entrée → sortie)</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {recap.recordedNet > 0 ? formatMinutesHuman(recap.recordedNet) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Mes créneaux</h2>
        {myShifts.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun créneau sur cette semaine.</p>
        ) : (
          <ul className="list-none space-y-2 text-sm text-slate-800">
            {myShifts.map((s) => (
              <li key={s.id} className="border-b border-slate-100 py-1.5 last:border-0">
                {formatMyShiftLineFr(s.starts_at, s.ends_at)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingClockOutShift && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="pointer-events-auto w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
            <p className="text-center text-xs text-slate-600">
              Journée en cours · {formatMyShiftLineFr(pendingClockOutShift.starts_at, pendingClockOutShift.ends_at)}
            </p>
            <button
              type="button"
              disabled={pending}
              className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
              onClick={() => clockOut(pendingClockOutShift.id)}
            >
              Je termine ma journée
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
