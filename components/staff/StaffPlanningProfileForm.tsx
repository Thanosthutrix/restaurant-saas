"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { updateStaffPlanningProfileAction } from "@/app/equipe/actions";
import type { StaffMember } from "@/lib/staff/types";
import {
  CONTRACT_LABELS_FR,
  CONTRACT_TYPES,
  type ContractType,
  type OpeningHoursMap,
  type PlanningDayKey,
  type TimeBand,
  parseOpeningHoursJson,
  PLANNING_DAY_KEYS,
  PLANNING_DAY_LABELS_FR,
} from "@/lib/staff/planningHoursTypes";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  member: StaffMember;
};

export function StaffPlanningProfileForm({ restaurantId, member }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [roleLabel, setRoleLabel] = useState(member.role_label ?? "");
  const [contractType, setContractType] = useState<string>(member.contract_type ?? "");
  const [targetHours, setTargetHours] = useState<string>(
    member.target_weekly_hours != null ? String(member.target_weekly_hours) : ""
  );
  const [maxDailyHours, setMaxDailyHours] = useState<string>(
    member.max_daily_hours != null ? String(member.max_daily_hours) : ""
  );
  const [notes, setNotes] = useState(member.planning_notes ?? "");

  const initialAvail = useMemo(
    () => parseOpeningHoursJson(member.availability_json ?? {}),
    [member.availability_json]
  );

  const [availMap, setAvailMap] = useState<OpeningHoursMap>(() => {
    const o: OpeningHoursMap = {};
    for (const k of PLANNING_DAY_KEYS) {
      const v = initialAvail[k];
      o[k] = v?.length ? v.map((b) => ({ ...b })) : [];
    }
    return o;
  });

  const initialPrep = useMemo(
    () => parseOpeningHoursJson(member.planning_prep_bands_json ?? {}),
    [member.planning_prep_bands_json]
  );

  const [prepMap, setPrepMap] = useState<OpeningHoursMap>(() => {
    const o: OpeningHoursMap = {};
    for (const k of PLANNING_DAY_KEYS) {
      const v = initialPrep[k];
      o[k] = v?.length ? v.map((b) => ({ ...b })) : [];
    }
    return o;
  });

  function setDay(key: PlanningDayKey, bands: TimeBand[]) {
    setAvailMap((prev) => ({ ...prev, [key]: bands }));
  }

  function addBand(key: PlanningDayKey) {
    const cur = availMap[key] ?? [];
    setDay(key, [...cur, { start: "09:00", end: "17:00" }]);
  }

  function updateBand(key: PlanningDayKey, i: number, field: "start" | "end", value: string) {
    const cur = [...(availMap[key] ?? [])];
    if (!cur[i]) return;
    cur[i] = { ...cur[i], [field]: value };
    setDay(key, cur);
  }

  function removeBand(key: PlanningDayKey, i: number) {
    const cur = [...(availMap[key] ?? [])];
    cur.splice(i, 1);
    setDay(key, cur);
  }

  function setPrepDay(key: PlanningDayKey, bands: TimeBand[]) {
    setPrepMap((prev) => ({ ...prev, [key]: bands }));
  }

  function addPrepBand(key: PlanningDayKey) {
    const cur = prepMap[key] ?? [];
    setPrepDay(key, [...cur, { start: "07:00", end: "10:00" }]);
  }

  function updatePrepBand(key: PlanningDayKey, i: number, field: "start" | "end", value: string) {
    const cur = [...(prepMap[key] ?? [])];
    if (!cur[i]) return;
    cur[i] = { ...cur[i], [field]: value };
    setPrepDay(key, cur);
  }

  function removePrepBand(key: PlanningDayKey, i: number) {
    const cur = [...(prepMap[key] ?? [])];
    cur.splice(i, 1);
    setPrepDay(key, cur);
  }

  function save() {
    setError(null);
    setOk(null);
    start(async () => {
      const r = await updateStaffPlanningProfileAction(restaurantId, member.id, {
        roleLabel: roleLabel.trim() || null,
        contractType: contractType || null,
        targetWeeklyHours: targetHours.trim() === "" ? null : Number(targetHours.replace(",", ".")),
        maxDailyHours: maxDailyHours.trim() === "" ? null : Number(maxDailyHours.replace(",", ".")),
        planningNotes: notes.trim() || null,
        availability: availMap,
        prepBands: prepMap,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk("Profil planning enregistré.");
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-4 border-t border-stone-100 pt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className={uiLabel} htmlFor={`role-${member.id}`}>
            Poste
          </label>
          <input
            id={`role-${member.id}`}
            list={`role-suggestions-${member.id}`}
            className={`${uiInput} mt-1 w-full text-sm`}
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
            placeholder="Ex. Glace, Vélo, Salle, Cuisine…"
          />
          <datalist id={`role-suggestions-${member.id}`}>
            <option value="Glace" />
            <option value="Vélo" />
            <option value="Salle" />
            <option value="Cuisine" />
            <option value="Caisse" />
            <option value="Gestion" />
          </datalist>
          <p className="mt-0.5 text-[10px] text-stone-500">
            Repris automatiquement dans le wizard d&apos;ébauche de planning (étape Équipe).
          </p>
        </div>
        <div>
          <label className={uiLabel} htmlFor={`ct-${member.id}`}>
            Contrat
          </label>
          <select
            id={`ct-${member.id}`}
            className={`${uiInput} mt-1 w-full text-sm`}
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
          >
            <option value="">—</option>
            {CONTRACT_TYPES.map((c: ContractType) => (
              <option key={c} value={c}>
                {CONTRACT_LABELS_FR[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={uiLabel} htmlFor={`th-${member.id}`}>
            Volume cible (h / semaine)
          </label>
          <input
            id={`th-${member.id}`}
            type="number"
            min={0}
            max={80}
            step={0.5}
            className={`${uiInput} mt-1 w-full text-sm`}
            value={targetHours}
            onChange={(e) => setTargetHours(e.target.value)}
            placeholder="ex. 35"
          />
        </div>
        <div>
          <label className={uiLabel} htmlFor={`mdh-${member.id}`}>
            Max. par jour (h)
          </label>
          <input
            id={`mdh-${member.id}`}
            type="number"
            min={0}
            max={16}
            step={0.5}
            className={`${uiInput} mt-1 w-full text-sm`}
            value={maxDailyHours}
            onChange={(e) => setMaxDailyHours(e.target.value)}
            placeholder="Illimité"
          />
          <p className="mt-0.5 text-[10px] text-stone-500">Heures nettes max. planifiables sur une journée.</p>
        </div>
        <div className="sm:col-span-3">
          <label className={uiLabel} htmlFor={`pn-${member.id}`}>
            Notes planning
          </label>
          <textarea
            id={`pn-${member.id}`}
            className={`${uiInput} mt-1 min-h-[3rem] w-full text-sm`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies horaires, formation, préférences…"
          />
        </div>
      </div>

      <details className="rounded-lg border border-stone-100 bg-white px-2 py-1">
        <summary className="cursor-pointer text-sm font-medium text-stone-800">
          Horaires habituels / souhaités (optionnel)
        </summary>
        <p className="mt-1 text-xs text-stone-500">
          Utilisé par la génération automatique du planning : si au moins un jour a une plage, les jours sans plage =
          indisponibles ce jour-là. Si tout est vide, la personne est considérée disponible sur toute l’ouverture. Les
          créneaux publiés restent ceux que vous saisissez ou validez ailleurs.
        </p>
        <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
          {PLANNING_DAY_KEYS.map((key) => (
            <div key={key} className="rounded border border-stone-100 p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-stone-700">{PLANNING_DAY_LABELS_FR[key]}</span>
                <button type="button" className={uiBtnOutlineSm} onClick={() => addBand(key)}>
                  +
                </button>
              </div>
              {(availMap[key]?.length ?? 0) === 0 ? (
                <p className="text-[10px] text-stone-400">Non renseigné</p>
              ) : (
                (availMap[key] ?? []).map((band, i) => (
                  <div key={i} className="mt-1 flex flex-wrap items-center gap-1">
                    <input
                      type="time"
                      className={`${uiInput} w-[5.5rem] text-xs`}
                      value={band.start}
                      onChange={(e) => updateBand(key, i, "start", e.target.value)}
                    />
                    <span className="text-xs">→</span>
                    <input
                      type="time"
                      className={`${uiInput} w-[5.5rem] text-xs`}
                      value={band.end}
                      onChange={(e) => updateBand(key, i, "end", e.target.value)}
                    />
                    <button
                      type="button"
                      className="text-[10px] text-rose-600"
                      onClick={() => removeBand(key, i)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-lg border border-stone-100 bg-white px-2 py-1">
        <summary className="cursor-pointer text-sm font-medium text-stone-800">
          Prépa & travail hors service client (optionnel)
        </summary>
        <p className="mt-1 text-xs text-stone-500">
          Plages en dehors de l’ouverture au public (mise en place, réception, inventaire…). Elles s’ajoutent aux
          disponibilités « service » pour les alertes et la génération auto. Si au moins un jour a une plage ici, un jour
          sans plage = pas de prépa ce jour-là.
        </p>
        <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
          {PLANNING_DAY_KEYS.map((key) => (
            <div key={`prep-${key}`} className="rounded border border-stone-100 p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-stone-700">{PLANNING_DAY_LABELS_FR[key]}</span>
                <button type="button" className={uiBtnOutlineSm} onClick={() => addPrepBand(key)}>
                  +
                </button>
              </div>
              {(prepMap[key]?.length ?? 0) === 0 ? (
                <p className="text-[10px] text-stone-400">Aucune plage hors client</p>
              ) : (
                (prepMap[key] ?? []).map((band, i) => (
                  <div key={i} className="mt-1 flex flex-wrap items-center gap-1">
                    <input
                      type="time"
                      className={`${uiInput} w-[5.5rem] text-xs`}
                      value={band.start}
                      onChange={(e) => updatePrepBand(key, i, "start", e.target.value)}
                    />
                    <span className="text-xs">→</span>
                    <input
                      type="time"
                      className={`${uiInput} w-[5.5rem] text-xs`}
                      value={band.end}
                      onChange={(e) => updatePrepBand(key, i, "end", e.target.value)}
                    />
                    <button
                      type="button"
                      className="text-[10px] text-rose-600"
                      onClick={() => removePrepBand(key, i)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </details>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-800">{ok}</p> : null}

      <button type="button" disabled={pending} className={uiBtnPrimarySm} onClick={save}>
        {pending ? "Enregistrement…" : "Enregistrer le profil planning"}
      </button>
    </div>
  );
}
