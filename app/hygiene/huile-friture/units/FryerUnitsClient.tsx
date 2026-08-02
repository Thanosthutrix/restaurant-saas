"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplets, Pencil, Plus, Power } from "lucide-react";
import type { FryerUnit } from "@/lib/fryerOil/types";
import {
  FRYER_RECURRENCE_TYPES,
  FRYER_RECURRENCE_LABEL_FR,
  FRYER_OIL_DEFAULTS,
} from "@/lib/fryerOil/types";
import { setFryerUnitActiveAction, upsertFryerUnitAction } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { FRYER_TILE } from "../fryerOilUi";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  units: FryerUnit[];
};

const empty = {
  id: null as string | null,
  name: "",
  location: "",
  capacity_liters: "",
  oil_temp_min_celsius: String(FRYER_OIL_DEFAULTS.oilTempMin),
  oil_temp_max_celsius: String(FRYER_OIL_DEFAULTS.oilTempMax),
  tpm_alert_threshold_pct: String(FRYER_OIL_DEFAULTS.tpmAlertPct),
  tpm_change_threshold_pct: String(FRYER_OIL_DEFAULTS.tpmChangePct),
  recurrence_type: "daily" as (typeof FRYER_RECURRENCE_TYPES)[number],
  active: true,
};

export function FryerUnitsClient({ restaurantId, units }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setForm(empty);
    setShowForm(true);
    setError(null);
  }

  function edit(u: FryerUnit) {
    setForm({
      id: u.id,
      name: u.name,
      location: u.location,
      capacity_liters: u.capacity_liters != null ? String(u.capacity_liters) : "",
      oil_temp_min_celsius: String(u.oil_temp_min_celsius),
      oil_temp_max_celsius: String(u.oil_temp_max_celsius),
      tpm_alert_threshold_pct: String(u.tpm_alert_threshold_pct),
      tpm_change_threshold_pct: String(u.tpm_change_threshold_pct),
      recurrence_type: u.recurrence_type,
      active: u.active,
    });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setError(null);
  }

  function submit() {
    setError(null);
    start(async () => {
      const cap = form.capacity_liters.trim()
        ? Number(form.capacity_liters.replace(",", "."))
        : null;
      const r = await upsertFryerUnitAction(restaurantId, {
        id: form.id,
        name: form.name,
        location: form.location,
        capacity_liters: cap,
        oil_temp_min_celsius: Number(form.oil_temp_min_celsius.replace(",", ".")),
        oil_temp_max_celsius: Number(form.oil_temp_max_celsius.replace(",", ".")),
        tpm_alert_threshold_pct: Number(form.tpm_alert_threshold_pct.replace(",", ".")),
        tpm_change_threshold_pct: Number(form.tpm_change_threshold_pct.replace(",", ".")),
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

  const Icon = FRYER_TILE.Icon;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openNew} className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}>
          <Plus className="h-4 w-4" aria-hidden />
          Nouvelle friteuse
        </button>
      </div>

      {units.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
          <p className="text-base font-semibold text-stone-800">Aucune friteuse configurée</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
            Ajoutez vos friteuses pour planifier les contrôles TPM, température et filtration.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {units.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => edit(u)}
                className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${FRYER_TILE.tile} ${
                  u.active ? "" : "opacity-60"
                }`}
              >
                <span className="absolute right-2 top-2 text-stone-300 transition group-hover:text-copper-500">
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${FRYER_TILE.tone}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-stone-900">{u.name}</span>
                <span className="text-[11px] tabular-nums text-stone-500">
                  TPM {u.tpm_alert_threshold_pct}/{u.tpm_change_threshold_pct} %
                </span>
                <span className="line-clamp-1 text-[11px] text-stone-400">
                  {FRYER_RECURRENCE_LABEL_FR[u.recurrence_type]}
                  {u.active ? "" : " · inactive"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <Modal
          title={form.id ? "Modifier la friteuse" : "Nouvelle friteuse"}
          icon={Droplets}
          tone={FRYER_TILE.tone}
          onClose={closeForm}
          size="lg"
          footer={
            <>
              <button type="button" disabled={pending} onClick={submit} className={uiBtnPrimary}>
                Enregistrer
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
                    start(async () => {
                      await setFryerUnitActiveAction(restaurantId, id, !form.active);
                      closeForm();
                      router.refresh();
                    });
                  }}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden />
                  {form.active ? "Désactiver" : "Réactiver"}
                </button>
              ) : null}
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className={uiLabel} htmlFor="fu-name">
                Nom
              </label>
              <input
                id="fu-name"
                className={uiInput + " mt-1 w-full"}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className={uiLabel} htmlFor="fu-loc">
                Emplacement
              </label>
              <input
                id="fu-loc"
                className={uiInput + " mt-1 w-full"}
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={uiLabel} htmlFor="fu-tmin">
                  T° huile min (°C)
                </label>
                <input
                  id="fu-tmin"
                  className={uiInput + " mt-1 w-full"}
                  value={form.oil_temp_min_celsius}
                  onChange={(e) => setForm((f) => ({ ...f, oil_temp_min_celsius: e.target.value }))}
                />
              </div>
              <div>
                <label className={uiLabel} htmlFor="fu-tmax">
                  T° huile max (°C)
                </label>
                <input
                  id="fu-tmax"
                  className={uiInput + " mt-1 w-full"}
                  value={form.oil_temp_max_celsius}
                  onChange={(e) => setForm((f) => ({ ...f, oil_temp_max_celsius: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={uiLabel} htmlFor="fu-tpm-alert">
                  Seuil alerte TPM (%)
                </label>
                <input
                  id="fu-tpm-alert"
                  className={uiInput + " mt-1 w-full"}
                  value={form.tpm_alert_threshold_pct}
                  onChange={(e) => setForm((f) => ({ ...f, tpm_alert_threshold_pct: e.target.value }))}
                />
              </div>
              <div>
                <label className={uiLabel} htmlFor="fu-tpm-change">
                  Changement huile TPM (%)
                </label>
                <input
                  id="fu-tpm-change"
                  className={uiInput + " mt-1 w-full"}
                  value={form.tpm_change_threshold_pct}
                  onChange={(e) => setForm((f) => ({ ...f, tpm_change_threshold_pct: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className={uiLabel} htmlFor="fu-rec">
                Fréquence contrôle
              </label>
              <select
                id="fu-rec"
                className={uiSelect + " mt-1 w-full"}
                value={form.recurrence_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    recurrence_type: e.target.value as typeof f.recurrence_type,
                  }))
                }
              >
                {FRYER_RECURRENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FRYER_RECURRENCE_LABEL_FR[t]}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
