"use client";

import { useMemo, useState, useTransition } from "react";
import { updateRestaurantStaffTargetsWeeklyAction } from "@/app/restaurants/actions";
import {
  type PlanningDayKey,
  PLANNING_DAY_KEYS,
  PLANNING_DAY_LABELS_FR,
} from "@/lib/staff/planningHoursTypes";
import { uiBtnPrimarySm, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  initial: Partial<Record<PlanningDayKey, number>>;
};

export function StaffTargetsWeeklyEditor({ restaurantId, initial }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [vals, setVals] = useState<Record<PlanningDayKey, string>>(() => {
    const o = {} as Record<PlanningDayKey, string>;
    for (const k of PLANNING_DAY_KEYS) {
      const v = initial[k];
      o[k] = v != null && Number.isFinite(v) ? String(v) : "";
    }
    return o;
  });

  const payload = useMemo(() => {
    const out: Partial<Record<PlanningDayKey, number>> = {};
    for (const k of PLANNING_DAY_KEYS) {
      const s = vals[k].trim();
      if (s === "") continue;
      const n = Number(s.replace(",", "."));
      if (Number.isFinite(n) && n >= 0 && n <= 500) out[k] = n;
    }
    return out;
  }, [vals]);

  function save() {
    setError(null);
    setOk(null);
    start(async () => {
      const r = await updateRestaurantStaffTargetsWeeklyAction(restaurantId, payload);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk("Objectifs d’effectif enregistrés.");
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Nombre de personnes souhaitées <strong>par jour type</strong> (avant exceptions fériés / vacances). Sert aux
        alertes sur la page Équipe.
      </p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-800">{ok}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {PLANNING_DAY_KEYS.map((k) => (
          <div key={k}>
            <label className={uiLabel} htmlFor={`st-${k}`}>
              {PLANNING_DAY_LABELS_FR[k]}
            </label>
            <input
              id={`st-${k}`}
              type="number"
              min={0}
              max={200}
              step={1}
              className={`${uiInput} mt-1 w-full text-sm`}
              value={vals[k]}
              onChange={(e) => setVals((prev) => ({ ...prev, [k]: e.target.value }))}
              placeholder="—"
            />
          </div>
        ))}
      </div>
      <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={save}>
        {pending ? "Enregistrement…" : "Enregistrer les objectifs"}
      </button>
    </div>
  );
}
