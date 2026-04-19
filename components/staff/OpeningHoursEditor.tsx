"use client";

import { useMemo, useState, useTransition } from "react";
import { updateRestaurantOpeningHoursAction } from "@/app/equipe/actions";
import {
  type OpeningHoursMap,
  type PlanningDayKey,
  type TimeBand,
  PLANNING_DAY_KEYS,
  PLANNING_DAY_LABELS_FR,
} from "@/lib/staff/planningHoursTypes";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiInput, uiLabel } from "@/components/ui/premium";

function emptyBands(): TimeBand[] {
  return [{ start: "11:30", end: "14:30" }];
}

type Props = {
  restaurantId: string;
  initial: OpeningHoursMap;
};

export function OpeningHoursEditor({ restaurantId, initial }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [map, setMap] = useState<OpeningHoursMap>(() => {
    const o: OpeningHoursMap = {};
    for (const k of PLANNING_DAY_KEYS) {
      const v = initial[k];
      o[k] = v?.length ? v.map((b) => ({ ...b })) : [];
    }
    return o;
  });

  const hasAnyBand = useMemo(
    () => PLANNING_DAY_KEYS.some((k) => (map[k]?.length ?? 0) > 0),
    [map]
  );

  function setDay(key: PlanningDayKey, bands: TimeBand[]) {
    setMap((prev) => ({ ...prev, [key]: bands }));
  }

  function addBand(key: PlanningDayKey) {
    const cur = map[key] ?? [];
    setDay(key, [...cur, { start: "12:00", end: "14:00" }]);
  }

  function updateBand(key: PlanningDayKey, i: number, field: "start" | "end", value: string) {
    const cur = [...(map[key] ?? [])];
    if (!cur[i]) return;
    cur[i] = { ...cur[i], [field]: value };
    setDay(key, cur);
  }

  function removeBand(key: PlanningDayKey, i: number) {
    const cur = [...(map[key] ?? [])];
    cur.splice(i, 1);
    setDay(key, cur);
  }

  function save() {
    setError(null);
    setOk(null);
    start(async () => {
      const r = await updateRestaurantOpeningHoursAction(restaurantId, map);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk("Horaires d’ouverture enregistrés.");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Définissez les plages où l’établissement est ouvert au public (midi, soir, etc.). Elles apparaissent en vert sur la
        grille et servent aux alertes « hors horaires ».
      </p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-800">{ok}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANNING_DAY_KEYS.map((key) => (
          <div key={key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{PLANNING_DAY_LABELS_FR[key]}</span>
              <button type="button" className={uiBtnOutlineSm} onClick={() => addBand(key)}>
                + Plage
              </button>
            </div>
            {(map[key]?.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-slate-400">Fermé — ajoutez une plage si besoin.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {(map[key] ?? []).map((band, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[5rem]">
                      <label className={uiLabel}>Début</label>
                      <input
                        type="time"
                        className={`${uiInput} mt-0.5 w-full text-sm`}
                        value={band.start}
                        onChange={(e) => updateBand(key, i, "start", e.target.value)}
                      />
                    </div>
                    <div className="min-w-[5rem]">
                      <label className={uiLabel}>Fin</label>
                      <input
                        type="time"
                        className={`${uiInput} mt-0.5 w-full text-sm`}
                        value={band.end}
                        onChange={(e) => updateBand(key, i, "end", e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="mb-0.5 text-xs font-medium text-rose-600 hover:underline"
                      onClick={() => removeBand(key, i)}
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={save}>
          {pending ? "Enregistrement…" : "Enregistrer les horaires d’ouverture"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={uiBtnOutlineSm}
          onClick={() => {
            const o: OpeningHoursMap = {};
            for (const k of PLANNING_DAY_KEYS) {
              const v = initial[k];
              o[k] = v?.length ? v.map((b) => ({ ...b })) : [];
            }
            setMap(o);
            setOk(null);
            setError(null);
          }}
        >
          Réinitialiser
        </button>
        {!hasAnyBand ? (
          <button
            type="button"
            className={uiBtnOutlineSm}
            onClick={() => {
              const o = { ...map };
              for (const k of ["mon", "tue", "wed", "thu", "fri"] as PlanningDayKey[]) {
                o[k] = emptyBands();
              }
              setMap(o);
            }}
          >
            Remplir lun–ven (ex. 11:30–14:30)
          </button>
        ) : null}
      </div>
    </div>
  );
}
