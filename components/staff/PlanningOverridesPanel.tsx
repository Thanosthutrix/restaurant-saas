"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deletePlanningDayOverrideAction,
  upsertPlanningDayOverrideAction,
} from "@/app/restaurants/actions";
import type { PlanningDayOverrideRow } from "@/lib/staff/planningResolve";
import { uiBtnPrimarySm, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  overrides: PlanningDayOverrideRow[];
};

function formatEtpDisplay(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function etpCell(o: PlanningDayOverrideRow): string {
  if (o.is_closed) return "—";
  if (o.staff_target_override == null || !Number.isFinite(o.staff_target_override)) {
    return "Modèle hebdo";
  }
  return formatEtpDisplay(o.staff_target_override);
}

export function PlanningOverridesPanel({ restaurantId, overrides }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [day, setDay] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [label, setLabel] = useState("");
  const [inheritOpening, setInheritOpening] = useState(true);
  const [bandRows, setBandRows] = useState([{ start: "11:30", end: "14:30" }]);
  const [inheritStaff, setInheritStaff] = useState(true);
  const [staffTarget, setStaffTarget] = useState("");

  function refresh() {
    router.refresh();
  }

  function remove(d: string) {
    setError(null);
    start(async () => {
      const r = await deletePlanningDayOverrideAction(restaurantId, d);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      refresh();
    });
  }

  function addOrUpdate() {
    setError(null);
    const d = day.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setError("Indiquez une date au format AAAA-MM-JJ.");
      return;
    }

    let openingBandsOverride: unknown | null = null;
    if (!isClosed) {
      openingBandsOverride = inheritOpening
        ? null
        : bandRows
            .map((b) => ({ start: b.start.trim(), end: b.end.trim() }))
            .filter((b) => b.start && b.end);
      if (!isClosed && !inheritOpening && (openingBandsOverride as { start: string; end: string }[]).length === 0) {
        setError("Ajoutez au moins une plage horaire ou cochez « Reprendre les horaires du jour type ».");
        return;
      }
    }

    let staffTargetOverride: number | null = null;
    if (!inheritStaff) {
      const n = Number(staffTarget.replace(",", ".").replace(/\s/g, ""));
      if (!Number.isFinite(n) || n < 0 || n > 500) {
        setError("ETP invalide (0 à 500, décimales autorisées).");
        return;
      }
      staffTargetOverride = Math.round(n * 100) / 100;
    }

    start(async () => {
      const r = await upsertPlanningDayOverrideAction(restaurantId, {
        day: d,
        isClosed,
        openingBandsOverride,
        staffTargetOverride,
        label: label.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDay("");
      setLabel("");
      setIsClosed(false);
      setInheritOpening(true);
      setInheritStaff(true);
      setStaffTarget("");
      setBandRows([{ start: "11:30", end: "14:30" }]);
      refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Ajoutez une ligne par <strong>date</strong> (férié, fermeture, horaires spéciaux…). Vous pouvez fixer des
        plages et un <strong>ETP</strong> (équivalent temps plein) pour ce jour, ou reprendre le modèle hebdomadaire.
      </p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Libellé</th>
              <th className="px-2 py-2">Statut</th>
              <th className="px-2 py-2">ETP cible</th>
              <th className="px-2 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {overrides.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-slate-500">
                  Aucune exception. Le modèle hebdo + objectifs s’appliquent toute l’année.
                </td>
              </tr>
            ) : (
              overrides.map((o) => (
                <tr key={o.day}>
                  <td className="px-2 py-2 font-mono text-xs">{o.day}</td>
                  <td className="px-2 py-2">
                    <span className="mr-1">{o.label ?? "—"}</span>
                    {o.calendar_source === "public_holiday" ? (
                      <span className="inline-block rounded bg-indigo-100 px-1.5 py-0 text-[10px] font-medium text-indigo-900">
                        Férié
                      </span>
                    ) : null}
                    {o.calendar_source === "school_vacation" ? (
                      <span className="ml-1 inline-block rounded bg-violet-100 px-1.5 py-0 text-[10px] font-medium text-violet-900">
                        Vacances
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    {o.is_closed ? (
                      <span className="text-rose-700">Fermé</span>
                    ) : (
                      <span className="text-slate-700">Ouvert (spécial)</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-slate-700">{etpCell(o)}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs font-medium text-rose-700 hover:underline"
                      onClick={() => remove(o.day)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Nouvelle exception</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={uiLabel} htmlFor="ov-day">
              Date
            </label>
            <input
              id="ov-day"
              type="date"
              className={`${uiInput} mt-1 w-full`}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <div>
            <label className={uiLabel} htmlFor="ov-label">
              Libellé (optionnel)
            </label>
            <input
              id="ov-label"
              className={`${uiInput} mt-1 w-full`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex. Noël, vacances Toussaint…"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isClosed} onChange={(e) => setIsClosed(e.target.checked)} />
          Établissement fermé ce jour-là
        </label>
        {!isClosed ? (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={inheritOpening}
                onChange={(e) => setInheritOpening(e.target.checked)}
              />
              Reprendre les horaires du jour type (modèle hebdo)
            </label>
            {!inheritOpening ? (
              <div className="space-y-2">
                {bandRows.map((row, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2">
                    <div>
                      <span className={uiLabel}>Début</span>
                      <input
                        type="time"
                        className={`${uiInput} mt-1`}
                        value={row.start}
                        onChange={(e) => {
                          const next = [...bandRows];
                          next[idx] = { ...next[idx], start: e.target.value };
                          setBandRows(next);
                        }}
                      />
                    </div>
                    <div>
                      <span className={uiLabel}>Fin</span>
                      <input
                        type="time"
                        className={`${uiInput} mt-1`}
                        value={row.end}
                        onChange={(e) => {
                          const next = [...bandRows];
                          next[idx] = { ...next[idx], end: e.target.value };
                          setBandRows(next);
                        }}
                      />
                    </div>
                    {bandRows.length > 1 ? (
                      <button
                        type="button"
                        className="mb-1 text-xs text-rose-600"
                        onClick={() => setBandRows((r) => r.filter((_, i) => i !== idx))}
                      >
                        Retirer
                      </button>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-700 hover:underline"
                  onClick={() => setBandRows((r) => [...r, { start: "18:30", end: "23:00" }])}
                >
                  + Plage (ex. service du soir)
                </button>
              </div>
            ) : null}
          </>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={inheritStaff} onChange={(e) => setInheritStaff(e.target.checked)} />
          Reprendre l’ETP du modèle hebdomadaire (jour type)
        </label>
        {!inheritStaff ? (
          <div>
            <label className={uiLabel} htmlFor="ov-staff">
              ETP (équivalent temps plein) ce jour
            </label>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Nombre d’équivalents temps plein nécessaires pour couvrir la journée (ex. 4,5).
            </p>
            <input
              id="ov-staff"
              type="number"
              min={0}
              max={500}
              step={0.25}
              className={`${uiInput} mt-1 w-36`}
              value={staffTarget}
              onChange={(e) => setStaffTarget(e.target.value)}
              placeholder="ex. 6,5"
            />
          </div>
        ) : null}
        <button type="button" disabled={pending || !day} className={uiBtnPrimarySm} onClick={addOrUpdate}>
          {pending ? "…" : "Enregistrer l’exception"}
        </button>
      </div>
    </div>
  );
}
