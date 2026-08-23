"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { OpeningHoursEditor } from "@/components/staff/OpeningHoursEditor";
import type { OpeningHoursMap } from "@/lib/staff/planningHoursTypes";
import { uiBtnPrimarySm, uiCard, uiInput, uiLabel } from "@/components/ui/premium";
import {
  updatePlatformOfficeHoursAction,
  updatePlatformPlanningSecurityFloorAction,
} from "./actions";

type Props = {
  officeHours: OpeningHoursMap;
  securityFloor: number;
};

export function PlatformOfficeHoursSection({ officeHours, securityFloor }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [floor, setFloor] = useState(String(securityFloor));
  const [floorMsg, setFloorMsg] = useState<string | null>(null);
  const [floorErr, setFloorErr] = useState<string | null>(null);

  function saveFloor() {
    setFloorMsg(null);
    setFloorErr(null);
    const n = Number(floor);
    startTransition(async () => {
      const r = await updatePlatformPlanningSecurityFloorAction(n);
      if (!r.ok) setFloorErr(r.error);
      else {
        setFloorMsg("Effectif minimum enregistré.");
        router.refresh();
      }
    });
  }

  return (
    <section className={uiCard}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Horaires bureau</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Plages de présence et effectif minimum pour la vue matrice
          </p>
        </div>
        <span className="text-xs font-medium text-amber-800">{expanded ? "Masquer" : "Personnaliser"}</span>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-6 border-t border-stone-100 pt-4">
          <OpeningHoursEditor
            variant="office"
            initial={officeHours}
            onSave={async (map) => {
              const r = await updatePlatformOfficeHoursAction(map);
              if (r.ok) router.refresh();
              return r;
            }}
          />

          <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-4">
            <label className="block max-w-xs">
              <span className={uiLabel}>Effectif minimum (talon de sécurité)</span>
              <p className="mt-0.5 text-xs text-stone-500">
                Alerte dans la vue matrice si moins de personnes planifiées pendant les plages bureau.
              </p>
              <div className="mt-2 flex items-end gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className={`${uiInput} w-24`}
                />
                <button type="button" disabled={pending} onClick={saveFloor} className={uiBtnPrimarySm}>
                  Enregistrer
                </button>
              </div>
            </label>
            {floorMsg ? <p className="mt-2 text-xs text-emerald-700">{floorMsg}</p> : null}
            {floorErr ? <p className="mt-2 text-xs text-red-600">{floorErr}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
