"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { InventoryItem } from "@/lib/db";
import type { PrepRecipeSuggestion } from "@/lib/recipes/findRecipeSuggestionForPrep";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { applySuggestedRecipeToPrep, type ApplyPrepRecipeComponent } from "./actions";
import { uiInput, uiSelect } from "@/components/ui/premium";

type DraftLine = ApplyPrepRecipeComponent;

export function PrepRecipeSuggestionBlock({
  inventoryItemId,
  parentItemId,
  restaurantId,
  suggestion,
  allItems,
}: {
  inventoryItemId: string;
  parentItemId: string;
  restaurantId: string;
  suggestion: PrepRecipeSuggestion;
  allItems: InventoryItem[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    suggestion ? suggestion.components.map((c) => ({ ...c })) : []
  );

  const draftNamesNorm = useMemo(
    () => new Set(lines.map((l) => normalizeInventoryItemName(l.name))),
    [lines]
  );
  const availableToAdd = useMemo(
    () =>
      allItems.filter(
        (i) => i.id !== parentItemId && !draftNamesNorm.has(normalizeInventoryItemName(i.name))
      ),
    [allItems, parentItemId, draftNamesNorm]
  );

  function updateQty(index: number, qty: number) {
    setLines((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], qty };
      return next;
    });
    setError(null);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  function addLine(item: InventoryItem, qty: number) {
    const itemType = (item.item_type || "ingredient") as "ingredient" | "prep" | "resale";
    setLines((prev) => [...prev, { name: item.name, unit: item.unit, itemType, qty }]);
    setError(null);
  }

  async function handleApply() {
    if (lines.length === 0) {
      setError("Le brouillon doit contenir au moins un composant.");
      return;
    }
    const invalid = lines.find((l) => !Number.isFinite(l.qty) || l.qty <= 0);
    if (invalid) {
      setError(`Quantité invalide pour "${invalid.name}".`);
      return;
    }
    setError(null);
    setLoading(true);
    const result = await applySuggestedRecipeToPrep({
      restaurantId,
      inventoryItemId,
      components: lines,
    });
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  if (!suggestion) return null;

  return (
    <div className="mb-6 rounded-2xl border border-violet-200/80 bg-violet-50/60 p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-violet-950">Suggestion de composition disponible</h2>
      <p className="mb-3 text-sm text-violet-800">
        Modifiez les quantités, supprimez ou ajoutez des lignes, puis appliquez le brouillon.
      </p>

      <ul className="mb-4 space-y-3">
        {lines.map((line, index) => (
          <li
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 shadow-sm"
          >
            <span className="w-32 shrink-0 font-semibold text-slate-900 sm:w-40">{line.name}</span>
            <input
              type="text"
              inputMode="decimal"
              value={line.qty === 0 ? "" : line.qty}
              onChange={(e) => {
                const v = e.target.value;
                const num = parseFloat(v.replace(",", "."));
                if (v === "") {
                  setLines((prev) => {
                    const next = [...prev];
                    if (next[index]) next[index] = { ...next[index], qty: 0 };
                    return next;
                  });
                } else if (Number.isFinite(num) && num >= 0) {
                  updateQty(index, num);
                }
              }}
              className={`w-20 ${uiInput}`}
              aria-label={`Quantité ${line.name}`}
            />
            <span className="w-8 shrink-0 text-sm text-slate-500">{line.unit}</span>
            <button
              type="button"
              disabled={loading}
              onClick={() => removeLine(index)}
              className="rounded-xl border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50"
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      {lines.length === 0 && (
        <p className="mb-3 text-sm text-amber-800">Ajoutez au moins un composant pour pouvoir appliquer le brouillon.</p>
      )}

      <AddLineForm available={availableToAdd} onAdd={addLine} disabled={loading} />

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={loading || lines.length === 0}
          className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-600 disabled:opacity-50"
        >
          {loading ? "Application…" : "Appliquer ce brouillon"}
        </button>
      </div>
    </div>
  );
}

function AddLineForm({
  available,
  onAdd,
  disabled,
}: {
  available: InventoryItem[];
  onAdd: (item: InventoryItem, qty: number) => void;
  disabled: boolean;
}) {
  const [componentItemId, setComponentItemId] = useState("");
  const [qty, setQty] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(qty.replace(",", "."));
    const item = available.find((i) => i.id === componentItemId);
    if (!item || !Number.isFinite(num) || num <= 0) return;
    onAdd(item, num);
    setComponentItemId("");
    setQty("");
  }

  if (available.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 border-t border-violet-200/80 pt-3">
      <span className="w-full text-sm font-semibold text-slate-800">+ Ajouter un composant</span>
      <select
        value={componentItemId}
        onChange={(e) => setComponentItemId(e.target.value)}
        className={`min-w-[12rem] ${uiSelect}`}
      >
        <option value="">Choisir un composant</option>
        {available.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.unit})
          </option>
        ))}
      </select>
      <input
        type="text"
        inputMode="decimal"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="Qté"
        className={`w-24 ${uiInput}`}
      />
      <button
        type="submit"
        disabled={disabled || !componentItemId || !qty.trim()}
        className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-800 shadow-sm transition hover:bg-violet-50 disabled:opacity-50"
      >
        Ajouter
      </button>
    </form>
  );
}
