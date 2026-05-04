"use server";

import { revalidatePath } from "next/cache";
import { assertCategoryAssignable } from "@/app/categories/actions";
import { supabaseServer } from "@/lib/supabaseServer";
import { getDish, getDishComponents, getInventoryItems } from "@/lib/db";
import { findRecipeSuggestionForDish } from "@/lib/recipes/findRecipeSuggestionForDish";
import { ensureResaleDishStockBinding } from "@/lib/recipes/ensureResaleDishStockBinding";
import { syncResaleInventoryCategoryFromDish } from "@/lib/recipes/syncResaleInventoryCategoryFromDish";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import {
  normalizeVatRatePct,
  roundSellingMoney,
  sellingPriceHtFromTtc,
} from "@/lib/tax/frenchSellingVat";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function syncDishRecipeStatus(dishId: string, restaurantId: string): Promise<void> {
  const [{ data: dish }, { data: comps }] = await Promise.all([getDish(dishId), getDishComponents(dishId)]);
  const count = (comps ?? []).length;
  let recipe_status: string;
  if (count === 0) {
    recipe_status = "missing";
  } else if (dish?.production_mode === "resale") {
    recipe_status = "validated";
  } else {
    recipe_status = "draft";
  }
  await supabaseServer
    .from("dishes")
    .update({ recipe_status })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId);
}

export async function addDishComponent(params: {
  restaurantId: string;
  dishId: string;
  inventoryItemId: string;
  qty: number;
}): Promise<ActionResult> {
  const { restaurantId, dishId, inventoryItemId, qty } = params;
  if (qty <= 0) return { ok: false, error: "La quantité doit être strictement positive." };

  const [dishRes, itemRes] = await Promise.all([
    supabaseServer.from("dishes").select("id, restaurant_id, production_mode").eq("id", dishId).maybeSingle(),
    supabaseServer.from("inventory_items").select("id, restaurant_id").eq("id", inventoryItemId).maybeSingle(),
  ]);

  const dish = dishRes.data as { id: string; restaurant_id: string; production_mode?: string } | null;
  const item = itemRes.data as { id: string; restaurant_id: string } | null;

  if (dishRes.error) return { ok: false, error: dishRes.error.message };
  if (itemRes.error) return { ok: false, error: itemRes.error.message };
  if (!dish) return { ok: false, error: "Plat introuvable." };
  if (!item) return { ok: false, error: "Composant introuvable." };
  if (dish.production_mode === "resale") {
    return {
      ok: false,
      error:
        "Les plats en revente sont liés à un seul article stock (même nom). Passez en « Préparé » pour une recette personnalisée.",
    };
  }
  if (dish.restaurant_id !== restaurantId || item.restaurant_id !== restaurantId) {
    return { ok: false, error: "Le plat et le composant doivent appartenir au même restaurant." };
  }

  const { error } = await supabaseServer.from("dish_components").insert({
    restaurant_id: restaurantId,
    dish_id: dishId,
    inventory_item_id: inventoryItemId,
    qty,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ce composant est déjà lié à ce plat." };
    return { ok: false, error: error.message };
  }
  await syncDishRecipeStatus(dishId, restaurantId);
  revalidatePath("/dishes");
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}

export async function updateDishSellingPrice(params: {
  dishId: string;
  restaurantId: string;
  sellingPriceTtc: number | null;
  sellingVatRatePct: number;
}): Promise<ActionResult> {
  const { dishId, restaurantId, sellingPriceTtc, sellingVatRatePct } = params;

  if (sellingPriceTtc !== null) {
    const n = Number(sellingPriceTtc);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Prix TTC invalide (nombre ≥ 0 ou vide)." };
  }

  const vat = normalizeVatRatePct(sellingVatRatePct, 10);

  const { data: dish, error: fetchErr } = await supabaseServer
    .from("dishes")
    .select("id")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!dish) return { ok: false, error: "Plat introuvable." };

  const ttc =
    sellingPriceTtc === null || sellingPriceTtc === 0 ? null : roundSellingMoney(sellingPriceTtc);
  const ht = ttc != null && ttc > 0 ? sellingPriceHtFromTtc(ttc, vat) : null;

  const { error } = await supabaseServer
    .from("dishes")
    .update({
      selling_price_ttc: ttc,
      selling_vat_rate_pct: vat,
      selling_price_ht: ht,
    })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}

export async function updateDishCategory(params: {
  dishId: string;
  restaurantId: string;
  categoryId: string | null;
}): Promise<ActionResult> {
  const { dishId, restaurantId, categoryId } = params;
  const check = await assertCategoryAssignable(categoryId, restaurantId, "dish");
  if (!check.ok) return { ok: false, error: check.error };

  const { error } = await supabaseServer
    .from("dishes")
    .update({ category_id: categoryId })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };

  const sync = await syncResaleInventoryCategoryFromDish(restaurantId, dishId);
  if (sync.error) return { ok: false, error: sync.error.message };

  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/dishes");
  revalidatePath("/inventory");
  revalidatePath("/salle");
  revalidatePath("/caisse");
  return { ok: true };
}

export async function updateDishComponent(params: {
  id: string;
  restaurantId: string;
  dishId: string;
  qty: number;
}): Promise<ActionResult> {
  const { id, restaurantId, dishId, qty } = params;
  if (qty <= 0) return { ok: false, error: "La quantité doit être strictement positive." };

  const { data: row, error: fetchError } = await supabaseServer
    .from("dish_components")
    .select("id, dish_id, inventory_item_id, restaurant_id")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!row) return { ok: false, error: "Ligne de composition introuvable." };

  const r = row as { dish_id: string; inventory_item_id: string };
  const [dishRes, itemRes] = await Promise.all([
    supabaseServer.from("dishes").select("id, restaurant_id").eq("id", r.dish_id).maybeSingle(),
    supabaseServer.from("inventory_items").select("id, restaurant_id").eq("id", r.inventory_item_id).maybeSingle(),
  ]);

  const dish = dishRes.data as { id: string; restaurant_id: string } | null;
  const item = itemRes.data as { id: string; restaurant_id: string } | null;

  if (dishRes.error) return { ok: false, error: dishRes.error.message };
  if (itemRes.error) return { ok: false, error: itemRes.error.message };
  if (!dish) return { ok: false, error: "Plat introuvable." };
  if (!item) return { ok: false, error: "Composant introuvable." };
  if (dish.restaurant_id !== restaurantId || item.restaurant_id !== restaurantId) {
    return { ok: false, error: "Le plat et le composant de cette ligne doivent appartenir au même restaurant." };
  }

  const { error } = await supabaseServer
    .from("dish_components")
    .update({ qty })
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  await syncDishRecipeStatus(dishId, restaurantId);
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}

export async function deleteDishComponent(params: {
  id: string;
  restaurantId: string;
  dishId: string;
}): Promise<ActionResult> {
  const { id, restaurantId, dishId } = params;

  const { data: row, error: fetchError } = await supabaseServer
    .from("dish_components")
    .select("id, dish_id, inventory_item_id, restaurant_id")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!row) return { ok: false, error: "Ligne de composition introuvable." };

  const r = row as { dish_id: string; inventory_item_id: string };
  const [dishRes, itemRes] = await Promise.all([
    supabaseServer.from("dishes").select("id, restaurant_id, production_mode").eq("id", r.dish_id).maybeSingle(),
    supabaseServer.from("inventory_items").select("id, restaurant_id").eq("id", r.inventory_item_id).maybeSingle(),
  ]);

  const dish = dishRes.data as { restaurant_id: string; production_mode?: string } | null;
  const item = itemRes.data as { restaurant_id: string } | null;

  if (dishRes.error) return { ok: false, error: dishRes.error.message };
  if (itemRes.error) return { ok: false, error: itemRes.error.message };
  if (!dish) return { ok: false, error: "Plat introuvable." };
  if (!item) return { ok: false, error: "Composant introuvable." };
  if (dish.production_mode === "resale") {
    return {
      ok: false,
      error: "Impossible de retirer le lien stock d’un plat en revente. Passez d’abord en « Préparé » si vous devez changer la composition.",
    };
  }
  if (dish.restaurant_id !== restaurantId || item.restaurant_id !== restaurantId) {
    return { ok: false, error: "Le plat et le composant de cette ligne doivent appartenir au même restaurant." };
  }

  const { error } = await supabaseServer
    .from("dish_components")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  await syncDishRecipeStatus(dishId, restaurantId);
  revalidatePath("/dishes");
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}

export async function updateDishProductionMode(params: {
  dishId: string;
  restaurantId: string;
  productionMode: "prepared" | "resale";
}): Promise<ActionResult> {
  const { dishId, restaurantId, productionMode } = params;

  const { data: dish, error: gErr } = await getDish(dishId);
  if (gErr || !dish) return { ok: false, error: gErr?.message ?? "Plat introuvable." };
  if (dish.restaurant_id !== restaurantId) return { ok: false, error: "Plat introuvable." };

  if (productionMode === "resale") {
    const bind = await ensureResaleDishStockBinding(restaurantId, dishId, dish.name);
    if (bind.error) return { ok: false, error: bind.error.message };
    const { error } = await supabaseServer
      .from("dishes")
      .update({ production_mode: "resale" })
      .eq("id", dishId)
      .eq("restaurant_id", restaurantId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error: delErr } = await supabaseServer
      .from("dish_components")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("dish_id", dishId);
    if (delErr) return { ok: false, error: delErr.message };
    const { error: upErr } = await supabaseServer
      .from("dishes")
      .update({ production_mode: "prepared", recipe_status: "missing" })
      .eq("id", dishId)
      .eq("restaurant_id", restaurantId);
    if (upErr) return { ok: false, error: upErr.message };
  }

  revalidatePath("/dishes");
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/inventory");
  revalidatePath("/margins", "page");
  return { ok: true };
}

/** Applique une suggestion de recette au plat : find-or-create inventory items, crée dish_components, met recipe_status = draft. Refuse si le plat a déjà des composants. */
export async function applySuggestedRecipeToDish(params: {
  restaurantId: string;
  dishId: string;
}): Promise<ActionResult> {
  const { restaurantId, dishId } = params;

  const { data: dish, error: dishError } = await getDish(dishId);
  if (dishError || !dish) return { ok: false, error: "Plat introuvable." };
  if (dish.restaurant_id !== restaurantId) return { ok: false, error: "Ce plat n'appartient pas à ce restaurant." };

  const suggestion = findRecipeSuggestionForDish(dish.name);
  if (!suggestion) return { ok: false, error: "Aucune suggestion de recette disponible pour ce plat." };

  const { data: existingComps } = await getDishComponents(dishId);
  if ((existingComps ?? []).length > 0) {
    return { ok: false, error: "Ce plat a déjà des composants. Supprimez-les d'abord pour appliquer une suggestion." };
  }

  const { data: existingItems } = await getInventoryItems(restaurantId);
  const items = existingItems ?? [];
  const nameToId = new Map<string, string>();
  for (const i of items) {
    nameToId.set(normalizeInventoryItemName(i.name), i.id);
  }

  const inventoryItemIds: string[] = [];
  for (const comp of suggestion.components) {
    const key = normalizeInventoryItemName(comp.name);
    let id = nameToId.get(key);
    if (!id) {
      const { data: created, error: createErr } = await supabaseServer
        .from("inventory_items")
        .insert({
          restaurant_id: restaurantId,
          name: comp.name.trim(),
          unit: comp.unit.trim() || "unit",
          item_type: comp.itemType,
        })
        .select("id")
        .single();
      if (createErr) return { ok: false, error: `Impossible de créer le composant "${comp.name}": ${createErr.message}.` };
      id = (created as { id: string }).id;
      nameToId.set(key, id);
    }
    inventoryItemIds.push(id);
  }

  for (let i = 0; i < suggestion.components.length; i++) {
    const { error: insertErr } = await supabaseServer.from("dish_components").insert({
      restaurant_id: restaurantId,
      dish_id: dishId,
      inventory_item_id: inventoryItemIds[i],
      qty: suggestion.components[i].qty,
    });
    if (insertErr) return { ok: false, error: insertErr.message };
  }

  await supabaseServer
    .from("dishes")
    .update({
      production_mode: suggestion.productionMode,
      recipe_status: "draft",
    })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId);

  revalidatePath("/dishes");
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/inventory");
  revalidatePath("/margins", "page");
  return { ok: true };
}

/** Passe la recette du plat en validée. Le plat doit avoir au moins un composant. */
export async function validateDishRecipe(params: {
  restaurantId: string;
  dishId: string;
}): Promise<ActionResult> {
  const { restaurantId, dishId } = params;

  const { data: dish, error: dishError } = await getDish(dishId);
  if (dishError || !dish) return { ok: false, error: "Plat introuvable." };
  if (dish.restaurant_id !== restaurantId) return { ok: false, error: "Ce plat n'appartient pas à ce restaurant." };

  const { data: comps } = await getDishComponents(dishId);
  if ((comps ?? []).length === 0) return { ok: false, error: "Impossible de valider : le plat n'a aucun composant." };

  const { error } = await supabaseServer
    .from("dishes")
    .update({ recipe_status: "validated" })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dishes");
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}

/** Repasse la recette du plat en brouillon. */
export async function markDishRecipeAsDraft(params: {
  restaurantId: string;
  dishId: string;
}): Promise<ActionResult> {
  const { restaurantId, dishId } = params;

  const { data: dish, error: dishError } = await getDish(dishId);
  if (dishError || !dish) return { ok: false, error: "Plat introuvable." };
  if (dish.restaurant_id !== restaurantId) return { ok: false, error: "Ce plat n'appartient pas à ce restaurant." };

  const { error } = await supabaseServer
    .from("dishes")
    .update({ recipe_status: "draft" })
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dishes");
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}

/** Supprime un plat. Échoue si le plat est utilisé dans des ventes (service_sales ou sales). */
export async function deleteDish(params: {
  restaurantId: string;
  dishId: string;
}): Promise<ActionResult> {
  const { restaurantId, dishId } = params;

  const { data: dish, error: dishError } = await getDish(dishId);
  if (dishError || !dish) return { ok: false, error: "Plat introuvable." };
  if (dish.restaurant_id !== restaurantId) return { ok: false, error: "Ce plat n'appartient pas à ce restaurant." };

  const { error } = await supabaseServer.from("dishes").delete().eq("id", dishId).eq("restaurant_id", restaurantId);

  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "Impossible de supprimer : ce plat est utilisé dans des ventes." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/dishes");
  revalidatePath(`/dishes/${dishId}`, "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}
