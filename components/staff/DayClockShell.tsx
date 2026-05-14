"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { clockInAction, clockOutAction } from "@/app/equipe/actions";
import { submitOpeningTemperatureLogAction } from "@/app/hygiene/haccp/actions";
import { findPendingArrival, findPendingClockOut, formatMyShiftLineFr } from "@/lib/staff/dayClock";
import type { WorkShiftWithDetails } from "@/lib/staff/types";
import type { TemperaturePoint } from "@/lib/haccpTemperature/types";
import { TEMPERATURE_POINT_TYPE_LABEL_FR } from "@/lib/haccpTemperature/types";
import { classifyTemperatureStatus, parseTemperatureInput } from "@/lib/haccpTemperature/rules";
import { uiBtnPrimarySm, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  myShifts: WorkShiftWithDetails[];
  /** Points de mesure HACCP actifs pour le relevé d'ouverture (vide = pas de relevé requis). */
  temperaturePoints?: TemperaturePoint[];
  children: React.ReactNode;
};

export function DayClockShell({ restaurantId, myShifts, temperaturePoints = [], children }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showTempModal, setShowTempModal] = useState(false);
  const [pendingShiftId, setPendingShiftId] = useState<string | null>(null);

  const [temps, setTemps] = useState<Map<string, string>>(
    () => new Map(temperaturePoints.map((p) => [p.id, ""]))
  );
  const [comments, setComments] = useState<Map<string, string>>(
    () => new Map(temperaturePoints.map((p) => [p.id, ""]))
  );

  const pendingClockOutShift = useMemo(() => findPendingClockOut(myShifts), [myShifts]);
  const pendingArrivalShift = useMemo(() => {
    if (pendingClockOutShift) return null;
    return findPendingArrival(myShifts, new Date());
  }, [myShifts, pendingClockOutShift]);

  function refresh() { router.refresh(); }

  function onStartDayClick(shiftId: string) {
    setError(null);
    if (temperaturePoints.length > 0) {
      setTemps(new Map(temperaturePoints.map((p) => [p.id, ""])));
      setComments(new Map(temperaturePoints.map((p) => [p.id, ""])));
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
    return temperaturePoints.every((p) => (temps.get(p.id) ?? "").trim() !== "");
  }

  /** Retourne le statut de température en temps réel pour un point (pour colorier le champ). */
  function getTempStatus(point: TemperaturePoint): "normal" | "alert" | "critical" | "empty" {
    const raw = temps.get(point.id) ?? "";
    if (!raw.trim()) return "empty";
    const parsed = parseTemperatureInput(raw);
    if (!parsed.ok) return "critical";
    return classifyTemperatureStatus(parsed.value, point.min_threshold, point.max_threshold);
  }

  function onSubmitTemps() {
    if (!pendingShiftId) return;
    setError(null);

    if (!allFilled()) {
      setError("Veuillez renseigner la température de chaque équipement avant de continuer.");
      return;
    }

    start(async () => {
      for (const point of temperaturePoints) {
        const r = await submitOpeningTemperatureLogAction(restaurantId, point.id, {
          temperatureRaw: temps.get(point.id) ?? "",
          comment: (comments.get(point.id) ?? "").trim() || null,
        });
        if (!r.ok) {
          setError(`${point.name} : ${r.error}`);
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

      {/* Modale relevés de température HACCP — obligatoires avant de pointer */}
      {showTempModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Relevés de température — ouverture
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Renseignez la température de chaque point de mesure avant de démarrer votre journée.
              </p>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-5 py-4 space-y-3">
              {temperaturePoints.map((point) => {
                const tempVal = temps.get(point.id) ?? "";
                const commentVal = comments.get(point.id) ?? "";
                const status = getTempStatus(point);
                const isAnomaly = status === "alert" || status === "critical";
                const inputBorder =
                  status === "critical"
                    ? "border-rose-400 focus:ring-rose-400"
                    : status === "alert"
                    ? "border-amber-400 focus:ring-amber-400"
                    : "";

                return (
                  <div
                    key={point.id}
                    className={`rounded-xl border p-3 ${isAnomaly ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}
                  >
                    <div className="mb-2">
                      <p className="text-sm font-medium text-slate-900">{point.name}</p>
                      <p className="text-xs text-slate-500">
                        {TEMPERATURE_POINT_TYPE_LABEL_FR[point.point_type]}
                        {point.location ? ` · ${point.location}` : ""}
                        {" · "}
                        <span className="font-medium">
                          {point.min_threshold} à {point.max_threshold} °C
                        </span>
                      </p>
                    </div>

                    <div>
                      <label className={`${uiLabel} text-[11px]`} htmlFor={`temp-${point.id}`}>
                        Température (°C) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id={`temp-${point.id}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={`${point.min_threshold} à ${point.max_threshold} °C`}
                        className={`${uiInput} mt-0.5 w-full tabular-nums ${inputBorder}`}
                        value={tempVal}
                        onChange={(e) =>
                          setTemps((prev) => { const n = new Map(prev); n.set(point.id, e.target.value); return n; })
                        }
                      />
                      {status === "critical" && (
                        <p className="mt-0.5 text-[11px] font-medium text-rose-700">
                          ⚠ Hors plage — commentaire obligatoire.
                        </p>
                      )}
                      {status === "alert" && (
                        <p className="mt-0.5 text-[11px] font-medium text-amber-700">
                          ⚠ Proche du seuil — un commentaire est recommandé.
                        </p>
                      )}
                    </div>

                    <div className="mt-2">
                      <label className={`${uiLabel} text-[11px]`} htmlFor={`comment-${point.id}`}>
                        Anomalie / commentaire{" "}
                        {isAnomaly ? (
                          <span className="text-rose-500">*</span>
                        ) : (
                          <span className="text-slate-400">(optionnel)</span>
                        )}
                      </label>
                      <input
                        id={`comment-${point.id}`}
                        type="text"
                        autoComplete="off"
                        placeholder={isAnomaly ? "Décrivez l'anomalie constatée…" : "ex. légère vibration, porte mal fermée…"}
                        className={`${uiInput} mt-0.5 w-full`}
                        value={commentVal}
                        onChange={(e) =>
                          setComments((prev) => { const n = new Map(prev); n.set(point.id, e.target.value); return n; })
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
                  Tous les champs de température sont obligatoires.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
