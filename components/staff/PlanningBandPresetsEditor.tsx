"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateRestaurantBandPresetsAction } from "@/app/restaurants/actions";
import type { PlanningBandPreset } from "@/lib/staff/planningBandPresets";
import {
  emptyPresetDraft,
  emptyWeeklyBandsDraft,
  presetHasAnyOpeningBand,
} from "@/lib/staff/planningBandPresets";
import {
  PLANNING_DAY_KEYS,
  PLANNING_DAY_LABELS_FR,
  type PlanningDayKey,
  type TimeBand,
} from "@/lib/staff/planningHoursTypes";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  initial: PlanningBandPreset[];
};

function clonePreset(p: PlanningBandPreset): PlanningBandPreset {
  return {
    ...p,
    bands: p.bands.map((b) => ({ ...b })),
    weeklyBands: p.weeklyBands
      ? Object.fromEntries(
          PLANNING_DAY_KEYS.map((k) => [k, (p.weeklyBands?.[k] ?? []).map((b) => ({ ...b }))])
        )
      : undefined,
    etp: p.etp ?? null,
  };
}

export function PlanningBandPresetsEditor({ restaurantId, initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [presets, setPresets] = useState<PlanningBandPreset[]>(() =>
    initial.length ? initial.map(clonePreset) : []
  );

  const canSave = useMemo(
    () => presets.every((p) => p.label.trim().length > 0 && presetHasAnyOpeningBand(p)),
    [presets]
  );

  function refresh() {
    router.refresh();
  }

  function addPreset() {
    setPresets((prev) => [...prev, emptyPresetDraft()]);
  }

  function removePreset(id: string) {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function setLabel(id: string, label: string) {
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, label } : p)));
  }

  function setScheduleKind(id: string, kind: PlanningBandPreset["scheduleKind"]) {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (kind === "weekly") {
          return {
            ...p,
            scheduleKind: "weekly",
            weeklyBands: p.weeklyBands ?? emptyWeeklyBandsDraft(),
          };
        }
        return {
          ...p,
          scheduleKind: "same_daily",
          bands: p.bands.length ? p.bands : [{ start: "11:30", end: "14:30" }],
        };
      })
    );
  }

  function addBand(presetId: string) {
    setPresets((prev) =>
      prev.map((p) =>
        p.id === presetId ? { ...p, bands: [...p.bands, { start: "19:00", end: "22:30" }] } : p
      )
    );
  }

  function updateBand(presetId: string, i: number, field: "start" | "end", value: string) {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        const bands = [...p.bands];
        if (!bands[i]) return p;
        bands[i] = { ...bands[i], [field]: value };
        return { ...p, bands };
      })
    );
  }

  function removeBand(presetId: string, i: number) {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        const bands = p.bands.filter((_, j) => j !== i);
        return { ...p, bands: bands.length ? bands : [{ start: "12:00", end: "14:00" }] };
      })
    );
  }

  function setWeeklyDayBands(presetId: string, dayKey: PlanningDayKey, bands: TimeBand[]) {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        return {
          ...p,
          weeklyBands: { ...p.weeklyBands, [dayKey]: bands },
        };
      })
    );
  }

  function addWeeklyBand(presetId: string, dayKey: PlanningDayKey) {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        const cur = p.weeklyBands?.[dayKey] ?? [];
        return {
          ...p,
          weeklyBands: {
            ...p.weeklyBands,
            [dayKey]: [...cur, { start: "19:00", end: "22:30" }],
          },
        };
      })
    );
  }

  function updateWeeklyBand(
    presetId: string,
    dayKey: PlanningDayKey,
    i: number,
    field: "start" | "end",
    value: string
  ) {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        const cur = [...(p.weeklyBands?.[dayKey] ?? [])];
        if (!cur[i]) return p;
        cur[i] = { ...cur[i], [field]: value };
        return { ...p, weeklyBands: { ...p.weeklyBands, [dayKey]: cur } };
      })
    );
  }

  function removeWeeklyBand(presetId: string, dayKey: PlanningDayKey, i: number) {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        const cur = (p.weeklyBands?.[dayKey] ?? []).filter((_, j) => j !== i);
        return { ...p, weeklyBands: { ...p.weeklyBands, [dayKey]: cur } };
      })
    );
  }

  function save() {
    setError(null);
    setOk(null);
    start(async () => {
      const r = await updateRestaurantBandPresetsAction(restaurantId, presets);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk("Modèles enregistrés.");
      refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-600">
        Créez des <strong className="font-medium text-stone-800">modèles nommés</strong> réutilisables dans le
        calendrier (fériés, vacances). Choisissez des plages identiques chaque jour, ou un{" "}
        <strong className="font-medium text-stone-800">modèle hebdomadaire</strong> (lun–dim) pour les vacances.
      </p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-800">{ok}</p> : null}

      <div className="space-y-4">
        {presets.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun modèle. Ajoutez-en un pour proposer des plages hors horaires types.</p>
        ) : (
          presets.map((p) => (
            <div key={p.id} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1">
                  <label className={uiLabel} htmlFor={`preset-label-${p.id}`}>
                    Nom du modèle
                  </label>
                  <input
                    id={`preset-label-${p.id}`}
                    className={`${uiInput} mt-1 w-full`}
                    value={p.label}
                    disabled={pending}
                    onChange={(e) => setLabel(p.id, e.target.value)}
                    placeholder="ex. Vacances d’été — plein régime"
                  />
                </div>
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs font-medium text-rose-700 hover:underline"
                  onClick={() => removePreset(p.id)}
                >
                  Supprimer ce modèle
                </button>
              </div>

              <div className="mt-3">
                <span className={uiLabel}>Type de modèle</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      p.scheduleKind === "same_daily"
                        ? "bg-copper-800 text-white"
                        : "border border-stone-200 bg-white text-stone-700"
                    }`}
                    onClick={() => setScheduleKind(p.id, "same_daily")}
                  >
                    Même plages chaque jour
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      p.scheduleKind === "weekly"
                        ? "bg-copper-800 text-white"
                        : "border border-stone-200 bg-white text-stone-700"
                    }`}
                    onClick={() => setScheduleKind(p.id, "weekly")}
                  >
                    Horaires par semaine (lun–dim)
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className={uiLabel} htmlFor={`preset-etp-${p.id}`}>
                  ETP cible (optionnel)
                </label>
                <p className="mt-0.5 text-[11px] text-stone-500">
                  Équivalent temps plein appliqué avec ce modèle au calendrier. Laisser vide pour reprendre l’objectif du
                  jour type.
                </p>
                <input
                  id={`preset-etp-${p.id}`}
                  type="number"
                  min={0}
                  max={500}
                  step={0.25}
                  className={`${uiInput} mt-1 w-36`}
                  value={p.etp ?? ""}
                  disabled={pending}
                  placeholder="ex. 6,5"
                  onChange={(e) => {
                    const v = e.target.value;
                    setPresets((prev) =>
                      prev.map((x) => {
                        if (x.id !== p.id) return x;
                        if (v === "" || v === "-") return { ...x, etp: null };
                        const n = Number(v.replace(",", "."));
                        if (!Number.isFinite(n) || n < 0 || n > 500) return x;
                        return { ...x, etp: Math.round(n * 100) / 100 };
                      })
                    );
                  }}
                />
              </div>

              {p.scheduleKind === "same_daily" ? (
                <div className="mt-3 space-y-2">
                  <span className={uiLabel}>Plages (début / fin, 24 h)</span>
                  {p.bands.map((b, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        className={`${uiInput} w-[7rem]`}
                        value={b.start}
                        disabled={pending}
                        onChange={(e) => updateBand(p.id, i, "start", e.target.value)}
                      />
                      <span className="text-stone-400">→</span>
                      <input
                        type="time"
                        className={`${uiInput} w-[7rem]`}
                        value={b.end}
                        disabled={pending}
                        onChange={(e) => updateBand(p.id, i, "end", e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={pending}
                        className={uiBtnOutlineSm}
                        onClick={() => removeBand(p.id, i)}
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                  <button type="button" disabled={pending} className={uiBtnOutlineSm} onClick={() => addBand(p.id)}>
                    + Plage
                  </button>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {PLANNING_DAY_KEYS.map((dayKey) => {
                    const dayBands = p.weeklyBands?.[dayKey] ?? [];
                    return (
                      <div key={dayKey} className="rounded-lg border border-stone-100 bg-stone-50/60 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-stone-800">
                            {PLANNING_DAY_LABELS_FR[dayKey]}
                          </span>
                          <button
                            type="button"
                            disabled={pending}
                            className="text-[11px] font-medium text-copper-800 hover:underline"
                            onClick={() => addWeeklyBand(p.id, dayKey)}
                          >
                            + Plage
                          </button>
                        </div>
                        {dayBands.length === 0 ? (
                          <p className="mt-1.5 text-xs text-stone-400">Fermé</p>
                        ) : (
                          <div className="mt-1.5 space-y-1.5">
                            {dayBands.map((b, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-1">
                                <input
                                  type="time"
                                  className={`${uiInput} w-[6.5rem] text-xs`}
                                  value={b.start}
                                  disabled={pending}
                                  onChange={(e) => updateWeeklyBand(p.id, dayKey, i, "start", e.target.value)}
                                />
                                <span className="text-stone-400">→</span>
                                <input
                                  type="time"
                                  className={`${uiInput} w-[6.5rem] text-xs`}
                                  value={b.end}
                                  disabled={pending}
                                  onChange={(e) => updateWeeklyBand(p.id, dayKey, i, "end", e.target.value)}
                                />
                                <button
                                  type="button"
                                  disabled={pending}
                                  className="text-[10px] text-rose-600 hover:underline"
                                  onClick={() => removeWeeklyBand(p.id, dayKey, i)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={uiBtnOutlineSm} onClick={addPreset}>
          Ajouter un modèle
        </button>
        <button type="button" disabled={pending || !canSave} className={uiBtnPrimarySm} onClick={save}>
          Enregistrer les modèles
        </button>
      </div>
    </div>
  );
}
