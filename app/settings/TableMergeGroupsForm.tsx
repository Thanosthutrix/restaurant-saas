"use client";

import { useState, useTransition } from "react";
import type { DiningTableMergeGroup } from "@/lib/reservations/capacitySettings";
import {
  deleteTableMergeGroupAction,
  saveTableMergeGroupAction,
} from "./actions";
import { uiLabel } from "@/components/ui/premium";

type TableOption = { id: string; label: string };

type Props = {
  initialGroups: DiningTableMergeGroup[];
  tables: TableOption[];
};

export function TableMergeGroupsForm({ initialGroups, tables }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleTable(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleAdd() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveTableMergeGroupAction({
        label,
        tableIds: selectedIds,
        capacity: Number(capacity),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGroups((prev) => [
        ...prev,
        {
          id: res.data!.id,
          restaurant_id: "",
          label: label.trim(),
          table_ids: selectedIds,
          capacity: Number(capacity),
          sort_order: prev.length,
          is_active: true,
        },
      ]);
      setLabel("");
      setSelectedIds([]);
      setCapacity("8");
      setSaved(true);
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteTableMergeGroupAction(id);
      if (!res.ok) setError(res.error);
      else setGroups((prev) => prev.filter((g) => g.id !== id));
    });
  }

  if (tables.length < 2) {
    return (
      <p className="text-sm text-stone-500">
        Créez au moins 2 tables actives dans{" "}
        <a href="/salle/tables" className="font-semibold text-copper-700 hover:underline">
          Salle → Tables
        </a>{" "}
        pour configurer des fusions.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Définissez des combinaisons de tables (ex. T.3 + T.4 → 8 couverts) pour autoriser de grands
        groupes en ligne sans augmenter la capacité totale du service.
      </p>

      {groups.length > 0 ? (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
            >
              <span>
                <strong>{g.label}</strong> — {g.capacity} pers. ·{" "}
                {g.table_ids
                  .map((id) => tables.find((t) => t.id === id)?.label ?? id.slice(0, 6))
                  .join(" + ")}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(g.id)}
                disabled={isPending}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-400">Aucune fusion configurée.</p>
      )}

      <div className="rounded-xl border border-dashed border-stone-300 p-4 space-y-3">
        <p className="text-sm font-semibold text-stone-800">Nouvelle fusion</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={uiLabel}>Libellé</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Grande table terrasse"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className={uiLabel}>Capacité fusionnée</span>
            <input
              type="number"
              min={2}
              max={50}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <fieldset>
          <legend className={uiLabel}>Tables à fusionner (min. 2)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {tables.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                  selectedIds.includes(t.id)
                    ? "border-copper-500 bg-copper-50 font-semibold"
                    : "border-stone-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selectedIds.includes(t.id)}
                  onChange={() => toggleTable(t.id)}
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || selectedIds.length < 2 || !label.trim()}
          className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
        >
          Ajouter la fusion
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-600">Fusion enregistrée.</p> : null}
    </div>
  );
}
