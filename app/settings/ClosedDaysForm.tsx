"use client";

import { useState, useTransition } from "react";
import { updateClosedDaysAction } from "./actions";

const DAYS_FR = [
  { dow: 1, label: "Lundi" },
  { dow: 2, label: "Mardi" },
  { dow: 3, label: "Mercredi" },
  { dow: 4, label: "Jeudi" },
  { dow: 5, label: "Vendredi" },
  { dow: 6, label: "Samedi" },
  { dow: 0, label: "Dimanche" },
];

export function ClosedDaysForm({ initialDays }: { initialDays: number[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialDays));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(dow: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dow)) next.delete(dow);
      else next.add(dow);
      return next;
    });
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateClosedDaysAction([...selected]);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Les tâches HACCP et les protocoles de nettoyage quotidiens ne seront pas générés ces jours-là.
      </p>
      <div className="flex flex-wrap gap-2">
        {DAYS_FR.map(({ dow, label }) => {
          const active = selected.has(dow);
          return (
            <button
              key={dow}
              type="button"
              onClick={() => toggle(dow)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
              }`}
            >
              {label}
              {active && <span className="ml-1.5 text-xs">Fermé</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Enregistré.</p>}
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
