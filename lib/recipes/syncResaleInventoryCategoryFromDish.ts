import { getCategoryById } from "@/lib/catalog/restaurantCategories";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Pour un plat en revente avec une rubrique carte, aligne la rubrique stock sur les
 * articles `item_type === "resale"` liés via `dish_components`.
 * Si la rubrique est encore `applies_to: dish`, la passe en `both` pour rester cohérente.
 */
export async function syncResaleInventoryCategoryFromDish(
  restaurantId: string,
  dishId: string
): Promise<{ error: Error | null }> {
  const { data: dish, error: dishErr } = await supabaseServer
    .from("dishes")
    .select("id, restaurant_id, production_mode, category_id")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (dishErr) return { error: new Error(dishErr.message) };
  const d = dish as {
    id: string;
    restaurant_id: string;
    production_mode?: string | null;
    category_id?: string | null;
  } | null;
  if (!d || d.production_mode !== "resale" || !d.category_id) {
    return { error: null };
  }

  const cat = await getCategoryById(d.category_id, restaurantId);
  if (cat.error) return { error: cat.error };
  if (!cat.data) return { error: new Error("Rubrique du plat introuvable.") };

  if (cat.data.applies_to === "dish") {
    const { error: upCatErr } = await supabaseServer
      .from("restaurant_categories")
      .update({ applies_to: "both" })
      .eq("id", d.category_id)
      .eq("restaurant_id", restaurantId);
    if (upCatErr) return { error: new Error(upCatErr.message) };
  }

  const { data: comps, error: compErr } = await supabaseServer
    .from("dish_components")
    .select("inventory_item_id")
    .eq("restaurant_id", restaurantId)
    .eq("dish_id", dishId);

  if (compErr) return { error: new Error(compErr.message) };
  const ids = [...new Set((comps ?? []).map((r) => (r as { inventory_item_id: string }).inventory_item_id))];
  if (ids.length === 0) return { error: null };

  const { data: items, error: itemsErr } = await supabaseServer
    .from("inventory_items")
    .select("id, item_type")
    .eq("restaurant_id", restaurantId)
    .in("id", ids);

  if (itemsErr) return { error: new Error(itemsErr.message) };
  const resaleIds = (items ?? [])
    .filter((row) => (row as { item_type: string }).item_type === "resale")
    .map((row) => (row as { id: string }).id);

  if (resaleIds.length === 0) return { error: null };

  const { error: upInvErr } = await supabaseServer
    .from("inventory_items")
    .update({ category_id: d.category_id })
    .eq("restaurant_id", restaurantId)
    .in("id", resaleIds);

  if (upInvErr) return { error: new Error(upInvErr.message) };
  return { error: null };
}
