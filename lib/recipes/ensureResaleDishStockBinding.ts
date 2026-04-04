import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { supabaseServer } from "@/lib/supabaseServer";

const RESALE_UNIT = "unit" as const;

/**
 * Plat en revente : article stock `resale` au même libellé, 1 ligne de composition (qty par défaut 1).
 * Recette du plat = validated (consommation service sans « recette cuisine »).
 * Remplace toute composition existante du plat.
 */
export async function ensureResaleDishStockBinding(
  restaurantId: string,
  dishId: string,
  dishName: string
): Promise<{ error: Error | null }> {
  const trimmed = dishName.trim();
  if (!trimmed) return { error: new Error("Nom du plat vide.") };

  const { data: rows, error: listErr } = await supabaseServer
    .from("inventory_items")
    .select("id, name, item_type")
    .eq("restaurant_id", restaurantId);
  if (listErr) return { error: new Error(listErr.message) };
  const key = normalizeInventoryItemName(trimmed);
  const items = (rows ?? []) as { id: string; name: string; item_type: string }[];
  const existing = items.find((i) => normalizeInventoryItemName(i.name) === key);

  let resaleItemId: string;
  if (existing) {
    if (existing.item_type !== "resale") {
      return {
        error: new Error(
          `Un article « ${existing.name} » existe déjà en ${
            existing.item_type === "prep" ? "préparation" : "matière première"
          }. Renommez le plat ou l’article pour lier la revente au stock.`
        ),
      };
    }
    resaleItemId = existing.id;
  } else {
    const { data: created, error: insErr } = await supabaseServer
      .from("inventory_items")
      .insert({
        restaurant_id: restaurantId,
        name: trimmed,
        unit: RESALE_UNIT,
        item_type: "resale",
        current_stock_qty: 0,
        recipe_status: "missing",
      })
      .select("id")
      .single();
    if (insErr) return { error: new Error(insErr.message) };
    resaleItemId = (created as { id: string }).id;
  }

  const { error: delErr } = await supabaseServer
    .from("dish_components")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("dish_id", dishId);
  if (delErr) return { error: new Error(delErr.message) };

  const { error: dcErr } = await supabaseServer.from("dish_components").insert({
    restaurant_id: restaurantId,
    dish_id: dishId,
    inventory_item_id: resaleItemId,
    qty: 1,
  });
  if (dcErr) return { error: new Error(dcErr.message) };

  const { error: upErr } = await supabaseServer
    .from("dishes")
    .update({ recipe_status: "validated" })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId);
  if (upErr) return { error: new Error(upErr.message) };

  return { error: null };
}
