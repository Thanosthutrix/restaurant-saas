"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dish, DishComponent, InventoryItem } from "@/lib/db";
import {
  addDishComponent,
  updateDishProductionMode,
  updateDishComponent,
  updateDishComponentRole,
  deleteDishComponent,
} from "./actions";
import { createInventoryItem } from "@/app/inventory/actions";
import { InventoryItemSearchOrCreate } from "@/components/InventoryItemSearchOrCreate";
import {
  uiBtnOutlineSm,
  uiCard,
  uiInput,
  uiSegmentActive,
  uiSegmentIdle,
} from "@/components/ui/premium";
import {
  DISH_COMPONENT_ROLE_LABELS,
  type DishComponentRole,
} from "@/lib/dining/lineModificationTypes";

export function DishComponentsBlock({
  dish,
  components,
  allItems,
  restaurantId,
}: {
  dish: Dish;
  components: DishComponent[];
  allItems: InventoryItem[];
  restaurantId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const router = useRouter();

  const itemById = new Map(allItems.map((i) => [i.id, i]));
  const alreadyUsed = new Set(components.map((c) => c.inventory_item_id));
  const isResale = dish.production_mode === "resale";

  function getQtyDisplay(comp: DishComponent): string {
    return qtyInputs[comp.id] ?? String(comp.qty);
  }

  async function handleSaveQty(comp: DishComponent) {
    const raw = getQtyDisplay(comp);
    const num = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) {
      setError("La quantité doit être strictement positive.");
      return;
    }
    setError(null);
    setSavingId(comp.id);
    const result = await updateDishComponent({
      id: comp.id,
      restaurantId,
      dishId: dish.id,
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
    const result = await addDishComponent({
      restaurantId,
      dishId: dish.id,
      inventoryItemId,
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
    const added = await addDishComponent({
      restaurantId,
      dishId: dish.id,
      inventoryItemId: created.data!.id,
      qty,
    });
    setLoading(false);
    if (added.ok) router.refresh();
    else setError(added.error);
  }

  async function handleRoleChange(comp: DishComponent, role: DishComponentRole) {
    const item = itemById.get(comp.inventory_item_id);
    if (item?.item_type === "prep") return;
    setError(null);
    setSavingRoleId(comp.id);
    const result = await updateDishComponentRole({
      id: comp.id,
      restaurantId,
      dishId: dish.id,
      componentRole: role,
    });
    setSavingRoleId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function handleDelete(compId: string) {
    setError(null);
    setDeletingId(compId);
    const result = await deleteDishComponent({ id: compId, restaurantId, dishId: dish.id });
    setDeletingId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function handleProductionMode(mode: "prepared" | "resale") {
    setError(null);
    const result = await updateDishProductionMode({ dishId: dish.id, restaurantId, productionMode: mode });
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="space-y-6">
      <div className={uiCard}>
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Mode de production</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleProductionMode("prepared")}
            className={dish.production_mode === "prepared" ? uiSegmentActive : uiSegmentIdle}
          >
            Préparé
          </button>
          <button
            type="button"
            onClick={() => handleProductionMode("resale")}
            className={dish.production_mode === "resale" ? uiSegmentActive : uiSegmentIdle}
          >
            Revente
          </button>
        </div>
      </div>

      <div className={uiCard}>
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Composants du plat</h2>

        {isResale ? (
          <p className="mb-3 text-sm text-stone-600">
            Revente : le stock suit l’article « revente » au même nom que le plat (une unité de stock par portion vendue,
            sauf quantité ci-dessous). Pas de recette cuisine — gérez les achats et le FIFO depuis Composants stockés.
          </p>
        ) : null}

        <ul className="mb-4 space-y-3">
          {components.length === 0 ? (
            <li className="text-sm text-stone-500">Aucun composant.</li>
          ) : (
            components.map((c) => {
              const item = itemById.get(c.inventory_item_id);
              const unit = item?.unit ?? "";
              const qtyDisplay = getQtyDisplay(c);
              const disabled = savingId === c.id || deletingId === c.id || savingRoleId === c.id;
              const isIngredient = item?.item_type === "ingredient";
              const role = (c.component_role ?? "integrated") as DishComponentRole;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2"
                >
                  <span className="w-32 shrink-0 font-semibold text-stone-900 sm:w-40">
                    {item?.name ?? c.inventory_item_id}
                  </span>
                  {isIngredient && !isResale ? (
                    <select
                      className={`min-w-[10rem] ${uiInput} text-xs`}
                      value={role}
                      disabled={disabled}
                      aria-label={`Rôle service ${item?.name ?? c.inventory_item_id}`}
                      onChange={(e) => void handleRoleChange(c, e.target.value as DishComponentRole)}
                    >
                      {(Object.keys(DISH_COMPONENT_ROLE_LABELS) as DishComponentRole[]).map((r) => (
                        <option key={r} value={r}>
                          {DISH_COMPONENT_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : item?.item_type === "prep" ? (
                    <span className="text-xs font-medium text-stone-500">Préparation (recette)</span>
                  ) : null}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={qtyDisplay}
                    onChange={(e) => setQtyInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    className={`w-20 ${uiInput}`}
                    disabled={disabled}
                    aria-label={`Quantité ${item?.name ?? c.inventory_item_id}`}
                  />
                  <span className="w-8 shrink-0 text-sm text-stone-500">{unit}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSaveQty(c)}
                      className={uiBtnOutlineSm}
                    >
                      {savingId === c.id ? "…" : "Enregistrer"}
                    </button>
                    {!isResale ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleDelete(c.id)}
                        className="rounded-xl border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50"
                      >
                        {deletingId === c.id ? "…" : "Retirer"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}

        {!isResale ? (
          <div className="border-t border-stone-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-stone-800">Ajouter un composant</p>
            <p className="mb-2 text-xs text-stone-500">
              Les ingrédients directs peuvent être marqués « Garniture retirable » ou « Accompagnement »
              pour la personnalisation au service. Les préparations restent intégrées à la recette.
            </p>
            <InventoryItemSearchOrCreate
              allItems={allItems}
              excludedIds={alreadyUsed}
              onAddExisting={handleAddExisting}
              onAddNew={handleAddNew}
              disabled={loading}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
