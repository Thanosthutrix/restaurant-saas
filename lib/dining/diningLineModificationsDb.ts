import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import type { DishCustomizableComponent } from "./lineModificationTypes";
import type { DiningLineModification } from "./lineModificationTypes";
import type { KitchenModsSnapshot } from "./lineModificationLogic";

type ModRow = {
  id: string;
  dining_order_line_id: string;
  modification_type: string;
  dish_component_id: string | null;
  inventory_item_id: string | null;
  replacement_inventory_item_id: string | null;
  inventory_items: { name: string } | { name: string }[] | null;
  replacement_item: { name: string } | { name: string }[] | null;
};

function itemName(join: ModRow["inventory_items"]): string {
  if (!join) return "Ingrédient";
  const row = Array.isArray(join) ? join[0] : join;
  return String(row?.name ?? "Ingrédient").trim() || "Ingrédient";
}

function mapModRow(row: ModRow): DiningLineModification {
  return {
    id: row.id,
    modificationType: row.modification_type as DiningLineModification["modificationType"],
    dishComponentId: row.dish_component_id,
    inventoryItemId: row.inventory_item_id,
    inventoryItemName: itemName(row.inventory_items),
    replacementInventoryItemId: row.replacement_inventory_item_id,
    replacementInventoryItemName: row.replacement_inventory_item_id
      ? itemName(row.replacement_item)
      : null,
  };
}

export async function listLineModificationsByLineIds(
  restaurantId: string,
  lineIds: string[]
): Promise<Map<string, DiningLineModification[]>> {
  const out = new Map<string, DiningLineModification[]>();
  if (lineIds.length === 0) return out;

  const { data, error } = await supabaseServer
    .from("dining_order_line_modifications")
    .select(
      `id, dining_order_line_id, modification_type, dish_component_id, inventory_item_id, replacement_inventory_item_id,
       inventory_items:inventory_item_id(name),
       replacement_item:replacement_inventory_item_id(name)`
    )
    .eq("restaurant_id", restaurantId)
    .in("dining_order_line_id", lineIds)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  for (const raw of (data ?? []) as unknown as ModRow[]) {
    const lineId = raw.dining_order_line_id;
    const arr = out.get(lineId) ?? [];
    arr.push(mapModRow(raw));
    out.set(lineId, arr);
  }
  return out;
}

/** Composants directs du plat modifiables au service (ingredient seulement, pas prep). */
export async function listCustomizableComponentsForDish(
  restaurantId: string,
  dishId: string
): Promise<DishCustomizableComponent[]> {
  const { data, error } = await supabaseServer
    .from("dish_components")
    .select(
      `id, inventory_item_id, component_role,
       inventory_items!inner(id, name, unit, item_type, restaurant_id)`
    )
    .eq("restaurant_id", restaurantId)
    .eq("dish_id", dishId)
    .in("component_role", ["topping", "accompaniment"]);

  if (error) throw new Error(error.message);

  const items: DishCustomizableComponent[] = [];
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const role = String(row.component_role ?? "");
    if (role !== "topping" && role !== "accompaniment") continue;
    const invRaw = row.inventory_items;
    const inv = Array.isArray(invRaw) ? invRaw[0] : invRaw;
    if (!inv || typeof inv !== "object") continue;
    const invRow = inv as { id: string; name: string; unit: string; item_type: string };
    if (invRow.item_type !== "ingredient") continue;
    items.push({
      dishComponentId: String(row.id),
      inventoryItemId: String(row.inventory_item_id),
      name: String(invRow.name ?? "").trim() || "Ingrédient",
      unit: String(invRow.unit ?? "").trim(),
      role,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function replaceLineModifications(params: {
  restaurantId: string;
  lineId: string;
  fingerprint: string | null;
  rows: {
    modificationType: string;
    dishComponentId: string;
    inventoryItemId: string;
    replacementInventoryItemId?: string | null;
  }[];
}): Promise<void> {
  const { error: delErr } = await supabaseServer
    .from("dining_order_line_modifications")
    .delete()
    .eq("restaurant_id", params.restaurantId)
    .eq("dining_order_line_id", params.lineId);
  if (delErr) throw new Error(delErr.message);

  if (params.rows.length > 0) {
    const { error: insErr } = await supabaseServer.from("dining_order_line_modifications").insert(
      params.rows.map((r) => ({
        restaurant_id: params.restaurantId,
        dining_order_line_id: params.lineId,
        modification_type: r.modificationType,
        dish_component_id: r.dishComponentId,
        inventory_item_id: r.inventoryItemId,
        replacement_inventory_item_id: r.replacementInventoryItemId ?? null,
      }))
    );
    if (insErr) throw new Error(insErr.message);
  }

  const { error: fpErr } = await supabaseServer
    .from("dining_order_lines")
    .update({ modification_fingerprint: params.fingerprint })
    .eq("id", params.lineId)
    .eq("restaurant_id", params.restaurantId);
  if (fpErr) throw new Error(fpErr.message);
}

/** Copie les modifs courantes dans le snapshot cuisine (après validation serveur). */
export async function validateKitchenModsForLine(params: {
  restaurantId: string;
  lineId: string;
  snapshot: KitchenModsSnapshot;
  lineAlreadySentToKitchen: boolean;
}): Promise<void> {
  const update: Record<string, unknown> = {
    kitchen_mods_snapshot: params.snapshot,
  };
  if (params.lineAlreadySentToKitchen) {
    update.is_prepared = false;
  }

  const { error } = await supabaseServer
    .from("dining_order_lines")
    .update(update)
    .eq("id", params.lineId)
    .eq("restaurant_id", params.restaurantId);
  if (error) throw new Error(error.message);
}
