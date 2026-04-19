"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateRestaurantBandPresetsAction } from "@/app/restaurants/actions";
import type { PlanningBandPreset } from "@/lib/staff/planningBandPresets";
import { emptyPresetDraft } from "@/lib/staff/planningBandPresets";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  initial: PlanningBandPreset[];
};

export function PlanningBandPresetsEditor({ restaurantId, initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [presets, setPresets] = useState<PlanningBandPreset[]>(() =>
    initial.length
      ? initial.map((p) => ({
          ...p,
          bands: p.bands.map((b) => ({ ...b })),
          etp: p.etp ?? null,
        }))
      : []
  );

  const canSave = useMemo(() => presets.every((p) => p.label.trim().length > 0 && p.bands.length > 0), [presets]);

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
      <p className="text-xs text-slate-600">
        Créez des <strong className="font-medium text-slate-800">modèles nommés</strong> (ex. « Été renforcé », « Férié
        service midi ») : vous pourrez les appliquer aux jours fériés et aux vacances scolaires dans le calendrier
        ci-dessous, en plus du modèle hebdomadaire habituel.
      </p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-800">{ok}</p> : null}

      <div className="space-y-4">
        {presets.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun modèle. Ajoutez-en un pour proposer des plages hors horaires types.</p>
        ) : (
          presets.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
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
                <label className={uiLabel} htmlFor={`preset-etp-${p.id}`}>
                  ETP cible (optionnel)
                </label>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Équivalent temps plein appliqué avec ce modèle au calendrier (fériés / vacances). Laisser vide pour
                  reprendre l’objectif du jour type.
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
                    <span className="text-slate-400">→</span>
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
