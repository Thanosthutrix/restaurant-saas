"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { InventoryItem, InventoryItemComponent } from "@/lib/db";
import {
  createInventoryItem,
  addInventoryItemComponent,
  updateInventoryItemComponent,
  deleteInventoryItemComponent,
} from "./actions";
import { InventoryItemSearchOrCreate } from "@/components/InventoryItemSearchOrCreate";
import { uiBtnOutlineSm, uiCard, uiInput } from "@/components/ui/premium";

export function PrepComponentsBlock({
  parentItem,
  components,
  allItems,
  restaurantId,
}: {
  parentItem: InventoryItem;
  components: InventoryItemComponent[];
  allItems: InventoryItem[];
  restaurantId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const router = useRouter();

  const itemById = new Map(allItems.map((i) => [i.id, i]));
  const alreadyUsed = new Set(components.map((c) => c.component_item_id));
  const excludedIds = useMemo(
    () => new Set<string>([...alreadyUsed, parentItem.id]),
    [alreadyUsed, parentItem.id]
  );

  function getQtyDisplay(comp: InventoryItemComponent): string {
    return qtyInputs[comp.id] ?? String(comp.qty);
  }

  async function handleSaveQty(comp: InventoryItemComponent) {
    const raw = getQtyDisplay(comp);
    const num = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) {
      setError("La quantité doit être strictement positive.");
      return;
    }
    setError(null);
    setSavingId(comp.id);
    const result = await updateInventoryItemComponent({
      id: comp.id,
      restaurantId,
      qty: num,
    });
    setSavingId(null);
    if (result.ok) {
      setQtyInputs((prev) => {
        const next = { ...prev };
        delete next[comp.id];
        return next;
      });
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleAddExisting(inventoryItemId: string, qty: number) {
    setError(null);
    setLoading(true);
    const result = await addInventoryItemComponent({
      restaurantId,
      parentItemId: parentItem.id,
      componentItemId: inventoryItemId,
      qty,
    });
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function handleAddNew(
    params: { name: string; unit: string; itemType: "ingredient" | "prep" | "resale"; currentStockQty?: number; minStockQty?: number | null },
    qty: number
  ) {
    setError(null);
    setLoading(true);
    const created = await createInventoryItem({
      restaurantId,
      name: params.name,
      unit: params.unit,
      itemType: params.itemType,
      currentStockQty: params.currentStockQty ?? 0,
      minStockQty: params.minStockQty,
    });
    if (!created.ok) {
      setLoading(false);
      setError(created.error);
      return;
    }
    const added = await addInventoryItemComponent({
      restaurantId,
      parentItemId: parentItem.id,
      componentItemId: created.data!.id,
      qty,
    });
    setLoading(false);
    if (added.ok) router.refresh();
    else setError(added.error);
  }

  async function handleDelete(comp: InventoryItemComponent) {
    setError(null);
    setDeletingId(comp.id);
    const result = await deleteInventoryItemComponent({ id: comp.id, restaurantId });
    setDeletingId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className={uiCard}>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        Composition de « {parentItem.name} »
      </h2>

      <ul className="mb-4 space-y-3">
        {components.length === 0 ? (
          <li className="text-sm text-slate-500">Aucun composant.</li>
        ) : (
          components.map((c) => {
            const comp = itemById.get(c.component_item_id);
            const unit = comp?.unit ?? "";
            const qtyDisplay = getQtyDisplay(c);
            const disabled = savingId === c.id || deletingId === c.id;
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <span className="w-32 shrink-0 font-semibold text-slate-900 sm:w-40">
                  {comp?.name ?? c.component_item_id}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={qtyDisplay}
                  onChange={(e) => setQtyInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className={`w-20 ${uiInput}`}
                  disabled={disabled}
                  aria-label={`Quantité ${comp?.name ?? c.component_item_id}`}
                />
                <span className="w-8 shrink-0 text-sm text-slate-500">{unit}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSaveQty(c)}
                    className={uiBtnOutlineSm}
                  >
                    {savingId === c.id ? "…" : "Enregistrer"}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDelete(c)}
                    className="rounded-xl border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50"
                  >
                    {deletingId === c.id ? "…" : "Retirer"}
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-sm font-semibold text-slate-800">Ajouter un composant</p>
        <InventoryItemSearchOrCreate
          allItems={allItems}
          excludedIds={excludedIds}
          onAddExisting={handleAddExisting}
          onAddNew={handleAddNew}
          disabled={loading}
        />
      </div>
    </div>
  );
}
