"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { updateRestaurantPeakBandsWeeklyAction } from "@/app/restaurants/actions";
import {
  type PeakBandWeeklyEntry,
  type PeakBandsWeeklyMap,
  serializePeakBandsWeeklyJson,
} from "@/lib/staff/planningPeakBands";
import {
  type PlanningDayKey,
  PLANNING_DAY_KEYS,
  PLANNING_DAY_LABELS_FR,
} from "@/lib/staff/planningHoursTypes";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  initial: PeakBandsWeeklyMap;
};

type DayState = Record<PlanningDayKey, PeakBandWeeklyEntry[]>;

function emptyDayState(initial: PeakBandsWeeklyMap): DayState {
  const o = {} as DayState;
  for (const k of PLANNING_DAY_KEYS) {
    o[k] = (initial[k] ?? []).map((b) => ({ ...b }));
  }
  return o;
}

export function PeakBandsWeeklyEditor({ restaurantId, initial }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [days, setDays] = useState<DayState>(() => emptyDayState(initial));

  const payload = useMemo(() => {
    const map: PeakBandsWeeklyMap = {};
    for (const k of PLANNING_DAY_KEYS) {
      const bands = days[k]
        .map((b) => ({
          start: b.start.trim(),
          end: b.end.trim(),
          staffCount: Number(b.staffCount),
        }))
        .filter((b) => b.start && b.end && Number.isFinite(b.staffCount) && b.staffCount > 0);
      if (bands.length > 0) map[k] = bands;
    }
    return serializePeakBandsWeeklyJson(map);
  }, [days]);

  function patchBand(day: PlanningDayKey, index: number, patch: Partial<PeakBandWeeklyEntry>) {
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }

  function addBand(day: PlanningDayKey) {
    setDays((prev) => ({
      ...prev,
      [day]: [...prev[day], { start: "12:00", end: "14:00", staffCount: 4 }],
    }));
  }

  function removeBand(day: PlanningDayKey, index: number) {
    setDays((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index),
    }));
  }

  function save() {
    setError(null);
    setOk(null);
    start(async () => {
      const r = await updateRestaurantPeakBandsWeeklyAction(restaurantId, payload);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk("Plages de pointe enregistrées.");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">
        Créneaux où l’effectif minimum doit être renforcé (rush midi, service du soir…). Ce modèle{" "}
        <strong>préremplit l’étape Pointe</strong> du questionnaire d’ébauche de planning sur la page Équipe.
      </p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-800">{ok}</p> : null}

      <div className="space-y-4">
        {PLANNING_DAY_KEYS.map((dayKey) => (
          <div key={dayKey} className="rounded-xl border border-stone-100 bg-stone-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-stone-900">{PLANNING_DAY_LABELS_FR[dayKey]}</p>
              <button
                type="button"
                disabled={pending}
                className={`${uiBtnOutlineSm} inline-flex items-center gap-1`}
                onClick={() => addBand(dayKey)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Plage
              </button>
            </div>
            {days[dayKey].length === 0 ? (
              <p className="mt-2 text-xs text-stone-500">Aucune plage — suggestion automatique à l’ébauche.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {days[dayKey].map((b, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      disabled={pending}
                      className={`${uiInput} w-[7rem] text-xs`}
                      value={b.start}
                      onChange={(e) => patchBand(dayKey, i, { start: e.target.value })}
                    />
                    <span className="text-stone-400">→</span>
                    <input
                      type="time"
                      disabled={pending}
                      className={`${uiInput} w-[7rem] text-xs`}
                      value={b.end}
                      onChange={(e) => patchBand(dayKey, i, { end: e.target.value })}
                    />
                    <label className="flex items-center gap-1 text-xs text-stone-600">
                      Min.
                      <input
                        type="number"
                        min={1}
                        max={200}
                        disabled={pending}
                        className={`${uiInput} w-14 text-xs`}
                        value={b.staffCount}
                        onChange={(e) =>
                          patchBand(dayKey, i, { staffCount: Number(e.target.value) || 1 })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-rose-600"
                      aria-label="Supprimer la plage"
                      onClick={() => removeBand(dayKey, i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={save}>
        {pending ? "Enregistrement…" : "Enregistrer les plages de pointe"}
      </button>
    </div>
  );
}
