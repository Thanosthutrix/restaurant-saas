"use client";

import { useState, useTransition } from "react";
import type { DiningWaitThresholds } from "@/lib/dining/diningWaitSettings";
import { updateDiningWaitThresholdsAction } from "./actions";
import { uiLabel } from "@/components/ui/premium";

type Props = {
  initial: DiningWaitThresholds;
};

export function DiningWaitSettingsForm({ initial }: Props) {
  const [greenMinutes, setGreenMinutes] = useState(String(initial.greenMinutes));
  const [orangeMinutes, setOrangeMinutes] = useState(String(initial.orangeMinutes));
  const [redMinutes, setRedMinutes] = useState(String(initial.redMinutes));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateDiningWaitThresholdsAction({
        greenMinutes: Number(greenMinutes),
        orangeMinutes: Number(orangeMinutes),
        redMinutes: Number(redMinutes),
      });
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Sur le plan de salle, un point bleu apparaît dès l&apos;envoi d&apos;une commande. Il passe au
        vert, orange puis rouge selon ces délais (en minutes). Deux points distincts : cuisine et bar.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className={uiLabel}>Bleu → vert</span>
          <input
            type="number"
            min={1}
            max={120}
            value={greenMinutes}
            onChange={(e) => setGreenMinutes(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-stone-400">minutes</span>
        </label>
        <label className="block space-y-1">
          <span className={uiLabel}>Vert → orange</span>
          <input
            type="number"
            min={2}
            max={180}
            value={orangeMinutes}
            onChange={(e) => setOrangeMinutes(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-stone-400">minutes</span>
        </label>
        <label className="block space-y-1">
          <span className={uiLabel}>Orange → rouge</span>
          <input
            type="number"
            min={3}
            max={240}
            value={redMinutes}
            onChange={(e) => setRedMinutes(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <span className="text-xs text-stone-400">minutes</span>
        </label>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-600">Enregistré.</p> : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-xl bg-copper-700 px-5 py-2 text-sm font-semibold text-white hover:bg-copper-600 disabled:opacity-50"
      >
        {isPending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
