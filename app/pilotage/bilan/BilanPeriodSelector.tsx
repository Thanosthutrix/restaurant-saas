"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uiBtnSecondary, uiInput, uiSelect } from "@/components/ui/premium";

const PRESET_OPTIONS = [
  { key: "month", label: "Mois en cours" },
  { key: "lastmonth", label: "Mois dernier" },
  { key: "year", label: "Année en cours" },
  { key: "lastyear", label: "Année précédente" },
  { key: "custom", label: "Période personnalisée" },
] as const;

type PeriodPreset = (typeof PRESET_OPTIONS)[number]["key"];

type Props = {
  preset: string;
  from: string;
  to: string;
  mode: "cash" | "perf";
  periodQuery: string;
};

function isPeriodPreset(value: string): value is PeriodPreset {
  return PRESET_OPTIONS.some((p) => p.key === value);
}

function isKnownPreset(preset: string): preset is Exclude<PeriodPreset, "custom"> {
  return PRESET_OPTIONS.some((p) => p.key === preset && p.key !== "custom");
}

export function BilanPeriodSelector({ preset, from, to, mode, periodQuery }: Props) {
  const router = useRouter();
  const customActive = preset === "custom" || !isKnownPreset(preset);
  const [selected, setSelected] = useState<PeriodPreset>(
    customActive ? "custom" : isKnownPreset(preset) ? preset : "custom"
  );
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function navigatePreset(key: string) {
    router.push(`/pilotage/bilan?p=${key}&m=${mode}`);
  }

  function handleSelectChange(value: string) {
    if (!isPeriodPreset(value)) return;
    setSelected(value);
    if (value !== "custom") {
      navigatePreset(value);
    }
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    router.push(`/pilotage/bilan?from=${customFrom}&to=${customTo}&m=${mode}`);
  }

  const periodLabel = new Date(from + "T12:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const periodLabelTo = new Date(to + "T12:00:00Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="bilan-period" className="mb-1.5 block text-xs font-medium text-stone-500">
            Période
          </label>
          <select
            id="bilan-period"
            value={selected}
            onChange={(e) => handleSelectChange(e.target.value)}
            className={`${uiSelect} w-full`}
          >
            {PRESET_OPTIONS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-stone-400">
            {periodLabel} → {periodLabelTo}
          </p>
        </div>

        <div className="shrink-0">
          <span className="mb-1.5 block text-xs font-medium text-stone-500">Vision</span>
          <span className="inline-flex overflow-hidden rounded-xl border border-stone-200">
            <Link
              href={`/pilotage/bilan?${periodQuery}&m=cash`}
              title="Ce qui est réellement sorti du compte : factures d'achats de la période."
              className={`px-3 py-2 text-sm font-medium transition ${
                mode === "cash" ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              Trésorerie
            </Link>
            <Link
              href={`/pilotage/bilan?${periodQuery}&m=perf`}
              title="Coût matière économique : consommation FIFO réelle des ventes de la période."
              className={`px-3 py-2 text-sm font-medium transition ${
                mode === "perf" ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              Performance
            </Link>
          </span>
        </div>
      </div>

      {selected === "custom" ? (
        <form
          onSubmit={applyCustom}
          className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <div className="min-w-0 flex-1 sm:max-w-[11rem]">
            <label htmlFor="bilan-from" className="mb-1 block text-xs font-medium text-stone-500">
              Du
            </label>
            <input
              id="bilan-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className={`${uiInput} w-full min-w-0`}
            />
          </div>
          <div className="min-w-0 flex-1 sm:max-w-[11rem]">
            <label htmlFor="bilan-to" className="mb-1 block text-xs font-medium text-stone-500">
              Au
            </label>
            <input
              id="bilan-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className={`${uiInput} w-full min-w-0`}
            />
          </div>
          <button type="submit" className={`${uiBtnSecondary} w-full sm:w-auto`}>
            Appliquer la période
          </button>
        </form>
      ) : null}
    </div>
  );
}
