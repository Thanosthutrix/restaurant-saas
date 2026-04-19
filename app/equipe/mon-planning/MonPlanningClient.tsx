"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { WorkShiftWithDetails } from "@/lib/staff/types";
import {
  actualDurationMinutes,
  formatMinutesHuman,
  plannedDurationMinutes,
  varianceMinutes,
} from "@/lib/staff/timeHelpers";
import { clockInAction, clockOutAction } from "../actions";
import { uiBtnPrimarySm, uiCard } from "@/components/ui/premium";

function formatDateTimeFr(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  restaurantId: string;
  shifts: WorkShiftWithDetails[];
};

export function MonPlanningClient({ restaurantId, shifts }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}

      {shifts.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun créneau à venir ou récent.</p>
      ) : (
        <ul className="space-y-3">
          {shifts.map((s) => {
            const planned = plannedDurationMinutes(s.starts_at, s.ends_at);
            const actual = actualDurationMinutes(
              s.attendance?.clock_in_at ?? null,
              s.attendance?.clock_out_at ?? null
            );
            const varMin = varianceMinutes(planned, actual);
            const needIn = !s.attendance?.clock_in_at;
            const needOut = Boolean(s.attendance?.clock_in_at && !s.attendance?.clock_out_at);
            const done = Boolean(s.attendance?.clock_in_at && s.attendance?.clock_out_at);

            return (
              <li key={s.id} className={`${uiCard}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créneau</p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatDateTimeFr(s.starts_at)} → {formatDateTimeFr(s.ends_at)}
                </p>
                {s.notes ? <p className="mt-1 text-xs text-slate-600">{s.notes}</p> : null}

                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  {s.attendance?.clock_in_at ? (
                    <p>Entrée : {formatDateTimeFr(s.attendance.clock_in_at)}</p>
                  ) : (
                    <p className="text-slate-400">Entrée : non pointée</p>
                  )}
                  {s.attendance?.clock_out_at ? (
                    <p>Sortie : {formatDateTimeFr(s.attendance.clock_out_at)}</p>
                  ) : (
                    <p className="text-slate-400">Sortie : non pointée</p>
                  )}
                  {varMin != null && (
                    <p className="text-xs text-slate-600">
                      Écart (durée) :{" "}
                      <span className="font-medium">{formatMinutesHuman(varMin)}</span> vs prévu{" "}
                      {formatMinutesHuman(planned)}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {needIn && (
                    <button
                      type="button"
                      disabled={pending}
                      className={uiBtnPrimarySm}
                      onClick={() => clockIn(s.id)}
                    >
                      Pointer l’arrivée
                    </button>
                  )}
                  {needOut && (
                    <button
                      type="button"
                      disabled={pending}
                      className={uiBtnPrimarySm}
                      onClick={() => clockOut(s.id)}
                    >
                      Pointer la sortie
                    </button>
                  )}
                  {done && (
                    <span className="text-sm text-emerald-700">Pointage complet pour ce créneau.</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
