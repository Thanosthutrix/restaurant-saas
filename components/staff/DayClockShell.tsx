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

type TempEntry = { temp: string; initials: string; skipped: boolean };

type Props = {
  restaurantId: string;
  myShifts: WorkShiftWithDetails[];
  /** Équipements froids à relever à l'ouverture (vide = pas de relevé requis). */
  coldElements?: HygieneElement[];
  children: React.ReactNode;
};

/**
 * Bandeau « Je démarre ma journée » en haut et barre fixe « Je termine ma journée » en bas (tableau de bord).
 * Si des équipements froids sont fournis et que l'utilisateur a accès à l'hygiène,
 * une modale de relevé de températures à l'ouverture s'intercale avant le pointage.
 */
export function DayClockShell({ restaurantId, myShifts, coldElements = [], children }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showTempModal, setShowTempModal] = useState(false);
  const [pendingShiftId, setPendingShiftId] = useState<string | null>(null);

  const initialEntries = (): Map<string, TempEntry> =>
    new Map(coldElements.map((el) => [el.id, { temp: "", initials: "", skipped: false }]));
  const [entries, setEntries] = useState<Map<string, TempEntry>>(initialEntries);

  const pendingClockOutShift = useMemo(() => findPendingClockOut(myShifts), [myShifts]);
  const pendingArrivalShift = useMemo(() => {
    if (pendingClockOutShift) return null;
    return findPendingArrival(myShifts, new Date());
  }, [myShifts, pendingClockOutShift]);

  const showEndBar = Boolean(pendingClockOutShift);

  function refresh() {
    router.refresh();
  }

  function onStartDayClick(shiftId: string) {
    setError(null);
    if (coldElements.length > 0) {
      setEntries(initialEntries());
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

  function updateEntry(elId: string, patch: Partial<TempEntry>) {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(elId, { ...prev.get(elId)!, ...patch });
      return next;
    });
  }

  function onSubmitTemps() {
    if (!pendingShiftId) return;
    setError(null);
    start(async () => {
      // Enregistrer chaque relevé non ignoré
      for (const el of coldElements) {
        const entry = entries.get(el.id);
        if (!entry || entry.skipped || !entry.temp.trim()) continue;
        const r = await logColdTemperatureReadingAction(restaurantId, el.id, {
          eventKind: "opening",
          temperatureCelsiusRaw: entry.temp,
          initials: entry.initials,
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

  function onSkipTemps() {
    if (!pendingShiftId) return;
    setShowTempModal(false);
    doClockIn(pendingShiftId);
  }

  const filledCount = coldElements.filter((el) => {
    const e = entries.get(el.id);
    return e && !e.skipped && e.temp.trim() !== "";
  }).length;

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
            onClick={() => onStartDayClick(pendingArrivalShift.id)}
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

      {/* Modale relevés de température à l'ouverture */}
      {showTempModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* En-tête */}
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Relevés de température — ouverture
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Renseignez les températures de vos équipements froids avant de démarrer.
              </p>
            </div>

            {/* Liste des équipements */}
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
              {coldElements.map((el) => {
                const entry = entries.get(el.id)!;
                const catLabel =
                  HYGIENE_CATEGORY_LABEL_FR[el.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ?? el.category;
                return (
                  <div
                    key={el.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      entry.skipped
                        ? "border-slate-100 bg-slate-50 opacity-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{el.name}</p>
                        <p className="text-xs text-slate-500">
                          {catLabel}{el.area_label ? ` · ${el.area_label}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
                        onClick={() => updateEntry(el.id, { skipped: !entry.skipped })}
                      >
                        {entry.skipped ? "Reprendre" : "Ignorer"}
                      </button>
                    </div>
                    {!entry.skipped && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className={`${uiLabel} text-[11px]`} htmlFor={`temp-${el.id}`}>
                            Température (°C)
                          </label>
                          <input
                            id={`temp-${el.id}`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="ex. 3,5 ou -18"
                            className={`${uiInput} mt-0.5 w-full tabular-nums`}
                            value={entry.temp}
                            onChange={(e) => updateEntry(el.id, { temp: e.target.value })}
                          />
                        </div>
                        <div className="w-28">
                          <label className={`${uiLabel} text-[11px]`} htmlFor={`ini-${el.id}`}>
                            Initiales
                          </label>
                          <input
                            id={`ini-${el.id}`}
                            type="text"
                            autoComplete="off"
                            maxLength={8}
                            placeholder="optionnel"
                            className={`${uiInput} mt-0.5 w-full`}
                            value={entry.initials}
                            onChange={(e) => updateEntry(el.id, { initials: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
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
            <div className="border-t border-slate-100 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className={`${uiBtnPrimarySm} flex-1 sm:flex-none`}
                  onClick={onSubmitTemps}
                >
                  {pending
                    ? "Enregistrement…"
                    : filledCount > 0
                    ? `Valider ${filledCount} relevé${filledCount > 1 ? "s" : ""} et démarrer`
                    : "Démarrer sans relevé"}
                </button>
              </div>
              <button
                type="button"
                disabled={pending}
                className={uiBtnSecondary}
                onClick={onSkipTemps}
              >
                Passer cette étape
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
