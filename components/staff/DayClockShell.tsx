"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { clockInAction, clockOutAction } from "@/app/equipe/actions";
import { logColdTemperatureReadingAction } from "@/app/hygiene/actions";
import { findPendingArrival, findPendingClockOut, formatMyShiftLineFr } from "@/lib/staff/dayClock";
import type { WorkShiftWithDetails } from "@/lib/staff/types";
import type { HygieneElement } from "@/lib/hygiene/types";
import { HYGIENE_CATEGORY_LABEL_FR } from "@/lib/hygiene/types";
import { uiBtnPrimarySm, uiBtnSecondary, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  myShifts: WorkShiftWithDetails[];
  /** Équipements froids à relever à l'ouverture (vide = pas de relevé requis). */
  coldElements?: HygieneElement[];
  children: React.ReactNode;
};

/**
 * Bandeau « Je démarre ma journée » avec modale de relevés de températures obligatoires
 * si des équipements froids sont configurés et que l'utilisateur a accès à l'hygiène.
 */
export function DayClockShell({ restaurantId, myShifts, coldElements = [], children }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showTempModal, setShowTempModal] = useState(false);
  const [pendingShiftId, setPendingShiftId] = useState<string | null>(null);

  const [temps, setTemps] = useState<Map<string, string>>(
    () => new Map(coldElements.map((el) => [el.id, ""]))
  );

  const pendingClockOutShift = useMemo(() => findPendingClockOut(myShifts), [myShifts]);
  const pendingArrivalShift = useMemo(() => {
    if (pendingClockOutShift) return null;
    return findPendingArrival(myShifts, new Date());
  }, [myShifts, pendingClockOutShift]);

  function refresh() {
    router.refresh();
  }

  function onStartDayClick(shiftId: string) {
    setError(null);
    if (coldElements.length > 0) {
      setTemps(new Map(coldElements.map((el) => [el.id, ""])));
      setPendingShiftId(shiftId);
      setShowTempModal(true);
    } else {
      doClockIn(shiftId);
    }
  }

  function doClockIn(shiftId: string) {
    start(async () => {
      const r = await clockInAction(restaurantId, shiftId);
      if (!r.ok) { setError(r.error); return; }
      refresh();
    });
  }

  function onEndDay(shiftId: string) {
    setError(null);
    start(async () => {
      const r = await clockOutAction(restaurantId, shiftId);
      if (!r.ok) { setError(r.error); return; }
      refresh();
    });
  }

  function allFilled(): boolean {
    for (const el of coldElements) {
      const t = temps.get(el.id) ?? "";
      if (!t.trim()) return false;
    }
    return true;
  }

  function onSubmitTemps() {
    if (!pendingShiftId) return;
    setError(null);

    if (!allFilled()) {
      setError("Veuillez renseigner la température de chaque équipement avant de continuer.");
      return;
    }

    start(async () => {
      for (const el of coldElements) {
        const tempRaw = temps.get(el.id) ?? "";
        const r = await logColdTemperatureReadingAction(restaurantId, el.id, {
          eventKind: "opening",
          temperatureCelsiusRaw: tempRaw,
          initials: "",
          comment: null,
        });
        if (!r.ok) {
          setError(`${el.name} : ${r.error}`);
          return;
        }
      }
      setShowTempModal(false);
      doClockIn(pendingShiftId);
    });
  }

  return (
    <div className={Boolean(pendingClockOutShift) ? "pb-28" : undefined}>
      {error && !showTempModal ? (
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
            onClick={() => onStartDayClick(pendingArrivalShift.id)}
          >
            Je démarre ma journée
          </button>
        </div>
      ) : null}

      {children}

      {Boolean(pendingClockOutShift) ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="pointer-events-auto w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
            <p className="text-center text-xs text-slate-600">
              Journée en cours · {formatMyShiftLineFr(pendingClockOutShift!.starts_at, pendingClockOutShift!.ends_at)}
            </p>
            <button
              type="button"
              disabled={pending}
              className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
              onClick={() => onEndDay(pendingClockOutShift!.id)}
            >
              Je termine ma journée
            </button>
          </div>
        </div>
      ) : null}

      {/* Modale relevés de température — obligatoires avant de pointer */}
      {showTempModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* En-tête */}
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Relevés de température — ouverture
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Renseignez la température de chaque équipement froid avant de démarrer votre journée.
              </p>
            </div>

            {/* Liste des équipements */}
            <div className="max-h-[55vh] overflow-y-auto px-5 py-4 space-y-3">
              {coldElements.map((el) => {
                const catLabel =
                  HYGIENE_CATEGORY_LABEL_FR[el.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ?? el.category;
                const val = temps.get(el.id) ?? "";
                return (
                  <div key={el.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-medium text-slate-900">{el.name}</p>
                    <p className="mb-2 text-xs text-slate-500">
                      {catLabel}{el.area_label ? ` · ${el.area_label}` : ""}
                    </p>
                    <div>
                      <label className={`${uiLabel} text-[11px]`} htmlFor={`temp-${el.id}`}>
                        Température (°C) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id={`temp-${el.id}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="ex. 3,5 ou -18"
                        className={`${uiInput} mt-0.5 w-full tabular-nums`}
                        value={val}
                        onChange={(e) =>
                          setTemps((prev) => {
                            const next = new Map(prev);
                            next.set(el.id, e.target.value);
                            return next;
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="mx-5 mb-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            {/* Pied */}
            <div className="border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                disabled={pending || !allFilled()}
                className={`${uiBtnPrimarySm} w-full py-3 text-base disabled:opacity-40`}
                onClick={onSubmitTemps}
              >
                {pending ? "Enregistrement…" : "Valider les relevés et démarrer ma journée"}
              </button>
              {!allFilled() && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  Tous les champs sont obligatoires.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
