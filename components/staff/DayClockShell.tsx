"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { clockInAction, clockOutAction } from "@/app/equipe/actions";
import { findPendingArrival, findPendingClockOut, formatMyShiftLineFr } from "@/lib/staff/dayClock";
import type { WorkShiftWithDetails } from "@/lib/staff/types";
import { uiBtnPrimarySm } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  myShifts: WorkShiftWithDetails[];
  children: React.ReactNode;
};

/**
 * Bandeau « Je démarre ma journée » en haut et barre fixe « Je termine ma journée » en bas (tableau de bord).
 */
export function DayClockShell({ restaurantId, myShifts, children }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pendingClockOutShift = useMemo(() => findPendingClockOut(myShifts), [myShifts]);

  const pendingArrivalShift = useMemo(() => {
    if (pendingClockOutShift) return null;
    return findPendingArrival(myShifts, new Date());
  }, [myShifts, pendingClockOutShift]);

  const showEndBar = Boolean(pendingClockOutShift);

  function refresh() {
    router.refresh();
  }

  function onStartDay(shiftId: string) {
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

  function onEndDay(shiftId: string) {
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

  return (
    <div className={showEndBar ? "pb-28" : undefined}>
      {error ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}

      {pendingArrivalShift ? (
        <div className="mb-8 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 shadow-sm">
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
            onClick={() => onStartDay(pendingArrivalShift.id)}
          >
            Je démarre ma journée
          </button>
        </div>
      ) : null}

      {children}

      {pendingClockOutShift ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="pointer-events-auto w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
            <p className="text-center text-xs text-slate-600">
              Journée en cours · {formatMyShiftLineFr(pendingClockOutShift.starts_at, pendingClockOutShift.ends_at)}
            </p>
            <button
              type="button"
              disabled={pending}
              className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
              onClick={() => onEndDay(pendingClockOutShift.id)}
            >
              Je termine ma journée
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
