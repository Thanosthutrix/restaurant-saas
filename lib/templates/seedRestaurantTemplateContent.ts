import { createDish, getDishes, getInventoryItems } from "@/lib/db";
import { supabaseServer } from "@/lib/supabaseServer";
import type { RestaurantTemplate } from "./restaurantTemplates";

/**
 * Crée les composants stock et plats suggérés du template (sans doublon sur les noms).
 * À appeler juste après la création du restaurant.
 */
export async function seedRestaurantTemplateContent(
  restaurantId: string,
  template: RestaurantTemplate
): Promise<{ error: string | null }> {
  if (template.components.length > 0) {
    const { data: existing } = await getInventoryItems(restaurantId);
    const existingNames = new Set((existing ?? []).map((i) => i.name.toLowerCase().trim()));
    const toInsert = template.components.filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (existingNames.has(key)) return false;
      existingNames.add(key);
      return true;
    });
    if (toInsert.length > 0) {
      const { error } = await supabaseServer.from("inventory_items").insert(
        toInsert.map((c) => ({
          restaurant_id: restaurantId,
          name: c.name.trim(),
          unit: c.unit,
          item_type: c.type,
          current_stock_qty: c.current_stock_qty,
          min_stock_qty: c.min_stock_qty,
        }))
      );
      if (error) return { error: error.message };
    }
  }

  if (template.suggestedDishes.length > 0) {
    const { data: existingDishes } = await getDishes(restaurantId);
    const existingDishNames = new Set((existingDishes ?? []).map((d) => d.name.toLowerCase().trim()));
    const toInsertDishes = template.suggestedDishes.filter(
      (d) => !existingDishNames.has(d.name.trim().toLowerCase())
    );
    for (const d of toInsertDishes) {
      const { error } = await createDish(restaurantId, d.name.trim(), d.production_mode);
      if (error) return { error: error.message };
    }
  }

  return { error: null };
}
