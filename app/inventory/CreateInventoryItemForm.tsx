"use client";

import { useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { ALLOWED_UNITS, STOCK_UNIT_LABEL_FR, type AllowedUnit } from "@/lib/constants";
import { createInventoryItem } from "./actions";
import { uiBtnPrimary, uiError, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

const ITEM_TYPES = [
  { value: "ingredient", label: "Matière première", active: "text-amber-700" },
  { value: "prep", label: "Préparation", active: "text-copper-800" },
  { value: "resale", label: "Revente", active: "text-emerald-700" },
] as const;

export function CreateInventoryItemForm({ restaurantId }: { restaurantId: string }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<AllowedUnit>("unit");
  const [itemType, setItemType] = useState<(typeof ITEM_TYPES)[number]["value"]>("ingredient");
  const [currentStockQty, setCurrentStockQty] = useState("");
  const [minStockQty, setMinStockQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [benchmarkHint, setBenchmarkHint] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBenchmarkHint(null);
    if (!name.trim()) return;
    const qty = currentStockQty === "" ? 0 : parseFloat(currentStockQty.replace(",", "."));
    const minQty = minStockQty.trim() === "" ? undefined : parseFloat(minStockQty.replace(",", "."));
    if (!Number.isFinite(qty) || qty < 0) return;
    if (minQty !== undefined && (!Number.isFinite(minQty) || minQty < 0)) return;
    setLoading(true);
    const result = await createInventoryItem({
      restaurantId,
      name: name.trim(),
      unit,
      itemType,
      currentStockQty: qty,
      minStockQty: minQty,
    });
    setLoading(false);
    if (result.ok) {
      setName("");
      setUnit("unit");
      setCurrentStockQty("");
      setMinStockQty("");
      if (result.data?.appliedBenchmark) {
        setBenchmarkHint(
          "Prix d’achat de référence prérempli depuis la base indicative France (moyenne marché HT). À ajuster après vos factures ou BL."
        );
      }
    } else {
      setError(result.error);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex flex-col items-center gap-2 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
          <Boxes className="h-5 w-5 text-copper-800" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Nouveau composant</h3>
          <p className="text-xs text-stone-500">Ajoutez une matière première, une préparation ou un article de revente.</p>
        </div>
      </div>

      {benchmarkHint ? (
        <p className="mb-3 rounded-xl border border-violet-200 bg-violet-50/90 px-3 py-2 text-xs text-violet-950">
          {benchmarkHint}
        </p>
      ) : null}
      {error && <p className={`mb-3 ${uiError}`}>{error}</p>}

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <span className={uiLabel}>Type</span>
          <div className="inline-flex h-11 items-center gap-1 self-start rounded-xl border border-stone-200 bg-stone-50 p-1">
            {ITEM_TYPES.map((t) => {
              const on = itemType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setItemType(t.value)}
                  className={`h-full rounded-lg px-3 text-sm font-semibold transition ${
                    on ? `bg-white ${t.active} shadow-sm ring-1 ring-stone-200` : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={uiLabel}>Nom</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. farine"
              className={`${uiInput} h-11 w-full`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Unité</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as AllowedUnit)}
              className={`${uiSelect} h-11 min-w-[7rem]`}
            >
              {ALLOWED_UNITS.map((u) => (
                <option key={u} value={u}>
                  {STOCK_UNIT_LABEL_FR[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Stock initial</span>
            <input
              type="text"
              inputMode="decimal"
              value={currentStockQty}
              onChange={(e) => setCurrentStockQty(e.target.value)}
              placeholder="0"
              className={`${uiInput} h-11 w-24`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Seuil min (opt.)</span>
            <input
              type="text"
              inputMode="decimal"
              value={minStockQty}
              onChange={(e) => setMinStockQty(e.target.value)}
              placeholder="—"
              className={`${uiInput} h-11 w-24`}
            />
          </label>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className={`${uiBtnPrimary} inline-flex h-11 items-center justify-center gap-1.5`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {loading ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </form>
  );
}
