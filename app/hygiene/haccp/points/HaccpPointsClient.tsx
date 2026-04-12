"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TemperaturePoint } from "@/lib/haccpTemperature/types";
import {
  TEMPERATURE_POINT_TYPES,
  TEMPERATURE_POINT_TYPE_LABEL_FR,
  TEMPERATURE_RECURRENCE_TYPES,
  TEMPERATURE_RECURRENCE_LABEL_FR,
} from "@/lib/haccpTemperature/types";
import { setTemperaturePointActiveAction, upsertTemperaturePointAction } from "../actions";
import { uiBtnPrimarySm, uiBtnSecondary, uiCard, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  points: TemperaturePoint[];
};

const empty = {
  id: null as string | null,
  name: "",
  point_type: "cold_storage" as (typeof TEMPERATURE_POINT_TYPES)[number],
  location: "",
  min_threshold: "",
  max_threshold: "",
  recurrence_type: "daily" as (typeof TEMPERATURE_RECURRENCE_TYPES)[number],
  active: true,
};

export function HaccpPointsClient({ restaurantId, points }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function edit(p: TemperaturePoint) {
    setShowForm(true);
    setError(null);
    setForm({
      id: p.id,
      name: p.name,
      point_type: p.point_type,
      location: p.location,
      min_threshold: String(p.min_threshold),
      max_threshold: String(p.max_threshold),
      recurrence_type: p.recurrence_type,
      active: p.active,
    });
  }

  function submit() {
    setError(null);
    const min = Number(form.min_threshold.replace(",", "."));
    const max = Number(form.max_threshold.replace(",", "."));
    start(async () => {
      const r = await upsertTemperaturePointAction(restaurantId, {
        id: form.id,
        name: form.name,
        point_type: form.point_type,
        location: form.location,
        min_threshold: min,
        max_threshold: max,
        recurrence_type: form.recurrence_type,
        active: form.active,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setShowForm(false);
      setForm(empty);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <button type="button" className={uiBtnPrimarySm} onClick={() => {
        setShowForm(true);
        setError(null);
        setForm(empty);
      }}>
        Nouveau point
      </button>

      {showForm && (
        <div className={`${uiCard} space-y-3`}>
          <h2 className="text-sm font-semibold text-slate-900">{form.id ? "Modifier" : "Créer"} un point</h2>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <div>
            <label className={uiLabel} htmlFor="tp-name">
              Nom
            </label>
            <input
              id="tp-name"
              className={`${uiInput} mt-1 w-full`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={uiLabel} htmlFor="tp-type">
              Type
            </label>
            <select
              id="tp-type"
              className={`${uiSelect} mt-1 w-full`}
              value={form.point_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, point_type: e.target.value as typeof f.point_type }))
              }
            >
              {TEMPERATURE_POINT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TEMPERATURE_POINT_TYPE_LABEL_FR[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={uiLabel} htmlFor="tp-loc">
              Emplacement
            </label>
            <input
              id="tp-loc"
              className={`${uiInput} mt-1 w-full`}
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="ex. Cuisine, ligne froide"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={uiLabel} htmlFor="tp-min">
                Seuil min (°C)
              </label>
              <input
                id="tp-min"
                type="text"
                inputMode="decimal"
                className={`${uiInput} mt-1 w-full tabular-nums`}
                value={form.min_threshold}
                onChange={(e) => setForm((f) => ({ ...f, min_threshold: e.target.value }))}
              />
            </div>
            <div>
              <label className={uiLabel} htmlFor="tp-max">
                Seuil max (°C)
              </label>
              <input
                id="tp-max"
                type="text"
                inputMode="decimal"
                className={`${uiInput} mt-1 w-full tabular-nums`}
                value={form.max_threshold}
                onChange={(e) => setForm((f) => ({ ...f, max_threshold: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className={uiLabel} htmlFor="tp-rec">
              Récurrence
            </label>
            <select
              id="tp-rec"
              className={`${uiSelect} mt-1 w-full`}
              value={form.recurrence_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, recurrence_type: e.target.value as typeof f.recurrence_type }))
              }
            >
              {TEMPERATURE_RECURRENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TEMPERATURE_RECURRENCE_LABEL_FR[t]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Point actif (génération de tâches)
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={submit}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              disabled={pending}
              className={uiBtnSecondary}
              onClick={() => {
                setShowForm(false);
                setForm(empty);
                setError(null);
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {points.map((p) => (
          <li key={p.id} className={`${uiCard} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="font-medium text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-500">
                {TEMPERATURE_POINT_TYPE_LABEL_FR[p.point_type]} · {p.location || "—"} ·{" "}
                {p.min_threshold}–{p.max_threshold} °C · {TEMPERATURE_RECURRENCE_LABEL_FR[p.recurrence_type]}
              </p>
              {!p.active && <span className="text-xs font-medium text-amber-700">Inactif</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={uiBtnSecondary} onClick={() => edit(p)}>
                Modifier
              </button>
              <button
                type="button"
                className={uiBtnSecondary}
                onClick={() =>
                  start(async () => {
                    await setTemperaturePointActiveAction(restaurantId, p.id, !p.active);
                    router.refresh();
                  })
                }
              >
                {p.active ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {points.length === 0 && !showForm && (
        <p className="text-sm text-slate-500">Aucun point. Créez-en un pour générer des relevés.</p>
      )}
    </div>
  );
}
