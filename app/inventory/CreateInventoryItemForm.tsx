"use client";

import { useState } from "react";
import { ALLOWED_UNITS, STOCK_UNIT_LABEL_FR, type AllowedUnit } from "@/lib/constants";
import { createInventoryItem } from "./actions";
import { uiBtnPrimarySm, uiCard, uiError, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

const ITEM_TYPES = [
  { value: "ingredient", label: "Matière première" },
  { value: "prep", label: "Préparation" },
  { value: "resale", label: "Revente" },
] as const;

export function CreateInventoryItemForm({ restaurantId }: { restaurantId: string }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<AllowedUnit>("unit");
  const [itemType, setItemType] = useState<(typeof ITEM_TYPES)[number]["value"]>("ingredient");
  const [currentStockQty, setCurrentStockQty] = useState("");
  const [minStockQty, setMinStockQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={uiCard}>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Nouveau composant</h3>
      {error && <p className={`mb-2 ${uiError}`}>{error}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Nom</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. farine"
            className={uiInput}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Unité</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as AllowedUnit)}
            className={`min-w-[7rem] ${uiSelect}`}
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
            className={`w-24 ${uiInput}`}
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
            className={`w-24 ${uiInput}`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={uiLabel}>Type</span>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value as (typeof ITEM_TYPES)[number]["value"])}
            className={uiSelect}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading || !name.trim()} className={uiBtnPrimarySm}>
          {loading ? "Création…" : "Créer"}
        </button>
      </div>
    </form>
  );
}
