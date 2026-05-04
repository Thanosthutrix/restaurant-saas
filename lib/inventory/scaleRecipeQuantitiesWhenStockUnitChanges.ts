import { roundRecipeQty } from "@/lib/units/stockUnitConversion";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Recettes où cet article est composant : met les quantités à l’échelle (ex. g → kg, facteur 1/1000).
 * Utilisé lors du changement d’unité de stock sur la fiche composant ou à l’onboarding tarifs facture.
 */
export async function scaleRecipeQuantitiesWhenStockUnitChanges(params: {
  restaurantId: string;
  inventoryItemId: string;
  factor: number;
}): Promise<{ error: string | null }> {
  const { restaurantId, inventoryItemId, factor } = params;

  const { data: iicRows, error: iicErr } = await supabaseServer
    .from("inventory_item_components")
    .select("id, qty")
    .eq("restaurant_id", restaurantId)
    .eq("component_item_id", inventoryItemId);

  if (iicErr) return { error: iicErr.message };

  for (const r of iicRows ?? []) {
    const id = (r as { id: string }).id;
    const q = Number((r as { qty: unknown }).qty);
    if (!Number.isFinite(q)) continue;
    const nq = roundRecipeQty(q * factor);
    if (nq <= 1e-9) {
      return {
        error:
          "Après changement d’unité, une quantité de recette (préparation) deviendrait nulle. Ajustez ou supprimez la ligne concernée, puis réessayez.",
      };
    }
    const { error } = await supabaseServer.from("inventory_item_components").update({ qty: nq }).eq("id", id);
    if (error) return { error: error.message };
  }

  const { data: dcRows, error: dcErr } = await supabaseServer
    .from("dish_components")
    .select("id, qty")
    .eq("restaurant_id", restaurantId)
    .eq("inventory_item_id", inventoryItemId);

  if (dcErr) return { error: dcErr.message };

  for (const r of dcRows ?? []) {
    const id = (r as { id: string }).id;
    const q = Number((r as { qty: unknown }).qty);
    if (!Number.isFinite(q)) continue;
    const nq = roundRecipeQty(q * factor);
    if (nq <= 1e-9) {
      return {
        error:
          "Après changement d’unité, une quantité de recette (plat) deviendrait nulle. Ajustez ou supprimez la ligne concernée, puis réessayez.",
      };
    }
    const { error } = await supabaseServer.from("dish_components").update({ qty: nq }).eq("id", id);
    if (error) return { error: error.message };
  }

  return { error: null };
}
