"use client";

import { useState } from "react";
import { GlassWater, Plus } from "lucide-react";
import { createInventoryItem } from "../actions";
import { uiBtnPrimary, uiError, uiInput, uiLabel } from "@/components/ui/premium";

export function CreateSupplyItemForm({ restaurantId }: { restaurantId: string }) {
  const [name, setName] = useState("");
  const [currentStockQty, setCurrentStockQty] = useState("");
  const [minStockQty, setMinStockQty] = useState("");
  const [targetStockQty, setTargetStockQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    const qty = currentStockQty === "" ? 0 : parseFloat(currentStockQty.replace(",", "."));
    const minQty = minStockQty.trim() === "" ? undefined : parseFloat(minStockQty.replace(",", "."));
    const targetQty = targetStockQty.trim() === "" ? undefined : parseFloat(targetStockQty.replace(",", "."));
    if (!Number.isFinite(qty) || qty < 0) return;
    if (minQty !== undefined && (!Number.isFinite(minQty) || minQty < 0)) return;
    if (targetQty !== undefined && (!Number.isFinite(targetQty) || targetQty < 0)) return;
    setLoading(true);
    const result = await createInventoryItem({
      restaurantId,
      name: name.trim(),
      unit: "unit",
      itemType: "supply",
      currentStockQty: qty,
      minStockQty: minQty,
      targetStockQty: targetQty,
    });
    setLoading(false);
    if (result.ok) {
      setName("");
      setCurrentStockQty("");
      setMinStockQty("");
      setTargetStockQty("");
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
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100/90">
          <GlassWater className="h-5 w-5 text-sky-700" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Nouvel article</h3>
          <p className="text-xs text-stone-500">
            Verres, carafes, couverts, nappes… Comptés en pièces, avec seuil de réappro si besoin.
          </p>
        </div>
      </div>

      {error && <p className={`mb-3 ${uiError}`}>{error}</p>}

      <div className="space-y-3">
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Nom</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Verre à eau 25 cl"
            className={`${uiInput} h-11 w-full min-w-0`}
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex min-w-0 flex-col gap-1">
            <span className={uiLabel}>Stock actuel</span>
            <input
              type="text"
              inputMode="decimal"
              value={currentStockQty}
              onChange={(e) => setCurrentStockQty(e.target.value)}
              placeholder="0"
              className={`${uiInput} h-11 w-full min-w-0`}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className={uiLabel}>Seuil min</span>
            <input
              type="text"
              inputMode="decimal"
              value={minStockQty}
              onChange={(e) => setMinStockQty(e.target.value)}
              placeholder="—"
              className={`${uiInput} h-11 w-full min-w-0`}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className={uiLabel}>Stock cible</span>
            <input
              type="text"
              inputMode="decimal"
              value={targetStockQty}
              onChange={(e) => setTargetStockQty(e.target.value)}
              placeholder="—"
              className={`${uiInput} h-11 w-full min-w-0`}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className={`${uiBtnPrimary} inline-flex h-11 w-full items-center justify-center gap-1.5 sm:w-auto`}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {loading ? "Création…" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}
