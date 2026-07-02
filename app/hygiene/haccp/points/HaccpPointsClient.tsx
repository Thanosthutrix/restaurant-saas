"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Power, SlidersHorizontal } from "lucide-react";
import type { TemperaturePoint } from "@/lib/haccpTemperature/types";
import {
  TEMPERATURE_POINT_TYPES,
  TEMPERATURE_POINT_TYPE_LABEL_FR,
  TEMPERATURE_RECURRENCE_TYPES,
  TEMPERATURE_RECURRENCE_LABEL_FR,
} from "@/lib/haccpTemperature/types";
import { setTemperaturePointActiveAction, upsertTemperaturePointAction } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { pointTypeMeta } from "../haccpUi";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

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

type FormState = typeof empty;

export function HaccpPointsClient({ restaurantId, points }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<FormState>(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setShowForm(true);
    setError(null);
    setForm(empty);
  }

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

  function closeForm() {
    setShowForm(false);
    setForm(empty);
    setError(null);
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
      closeForm();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openNew} className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}>
          <Plus className="h-4 w-4" aria-hidden />
          Nouveau point
        </button>
      </div>

      {points.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
          <p className="text-base font-semibold text-stone-800">Aucun point de mesure</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
            Créez un point (frigo, congélateur, maintien au chaud…) avec ses seuils : les relevés seront générés
            automatiquement selon la fréquence choisie.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {points.map((p) => {
            const meta = pointTypeMeta(p.point_type);
            const Icon = meta.Icon;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => edit(p)}
                  className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${meta.tile} ${
                    p.active ? "" : "opacity-60"
                  }`}
                >
                  <span className="absolute right-2 top-2 text-stone-300 transition group-hover:text-copper-500">
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${meta.tone}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                    {p.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-stone-500">
                    {p.min_threshold}–{p.max_threshold} °C
                  </span>
                  <span className="line-clamp-1 text-[11px] text-stone-400">
                    {TEMPERATURE_RECURRENCE_LABEL_FR[p.recurrence_type]}
                    {p.active ? "" : " · inactif"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showForm ? (
        <Modal
          title={form.id ? "Modifier le point" : "Nouveau point de mesure"}
          icon={form.id ? Pencil : SlidersHorizontal}
          tone="bg-sky-50 text-sky-700"
          onClose={closeForm}
          footer={
            <>
              <button type="button" disabled={pending} onClick={submit} className={uiBtnPrimary}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button type="button" disabled={pending} onClick={closeForm} className={uiBtnSecondary}>
                Annuler
              </button>
              {form.id ? (
                <button
                  type="button"
                  disabled={pending}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  onClick={() => {
                    const id = form.id;
                    if (!id) return;
                    const nextActive = !form.active;
                    start(async () => {
                      await setTemperaturePointActiveAction(restaurantId, id, nextActive);
                      closeForm();
                      router.refresh();
                    });
                  }}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {form.active ? "Désactiver" : "Réactiver"}
                </button>
              ) : null}
              {error ? <span className="text-sm text-rose-700">{error}</span> : null}
            </>
          }
        >
          <div className="space-y-3">
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
                onChange={(e) => setForm((f) => ({ ...f, point_type: e.target.value as typeof f.point_type }))}
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
                onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value as typeof f.recurrence_type }))}
              >
                {TEMPERATURE_RECURRENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TEMPERATURE_RECURRENCE_LABEL_FR[t]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Point actif (génération de tâches)
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
