"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ALLOWED_STOCK_UNITS_HELP_FR, parseAllowedStockUnit, type AllowedUnit } from "@/lib/constants";
import { getRestaurantForPage } from "@/lib/auth";
import { getDishes, getInventoryItems } from "@/lib/db";
import { getImageBuffersFromFormData } from "@/lib/getMenuImageBuffersFromFormData";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import { analyzeRecipeImageFromBuffer, type RecipePhotoSuggestion } from "@/lib/recipe-photo-analysis";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { supabaseServer } from "@/lib/supabaseServer";

export type RecipeImportIngredientPayload = {
  name: string;
  qty: number | null;
  unit: AllowedUnit | null;
};

export type RecipeImportPayload = {
  selected: boolean;
  dish_name: string;
  normalized_label: string;
  ingredients: RecipeImportIngredientPayload[];
};

export type ApplyRecipeImportResult = {
  ok: boolean;
  applied: number;
  replaced: number;
  skipped: number;
  errors: string[];
};

export type AnalyzeMoreRecipePhotosResult = {
  ok: boolean;
  suggestions: RecipePhotoSuggestion[];
  errors: string[];
};

export async function analyzeMoreOnboardingRecipePhotos(
  formData: FormData
): Promise<AnalyzeMoreRecipePhotosResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const buffers = await getImageBuffersFromFormData(formData, "recipe_image");
  if (buffers.length === 0) {
    return { ok: false, suggestions: [], errors: ["Ajoutez au moins une photo de recette."] };
  }

  const suggestions: RecipePhotoSuggestion[] = [];
  const errors: string[] = [];
  for (const buffer of buffers) {
    const result = await analyzeRecipeImageFromBuffer(buffer);
    if (result.error) errors.push(result.error);
    suggestions.push(...result.suggestions);
  }

  if (suggestions.length === 0) {
    return {
      ok: false,
      suggestions: [],
      errors: errors.length > 0 ? errors : ["Aucune recette fiable détectée sur ces photos."],
    };
  }

  return { ok: true, suggestions, errors };
}

function normalizeUnit(raw: string | null | undefined): AllowedUnit {
  return raw ? (parseAllowedStockUnit(raw) ?? "unit") : "unit";
}

async function getOrCreateIngredient(params: {
  restaurantId: string;
  name: string;
  unit: string;
  nameToId: Map<string, string>;
}): Promise<string | null> {
  const trimmed = params.name.trim();
  if (!trimmed) return null;
  const key = normalizeInventoryItemName(trimmed);
  const existing = params.nameToId.get(key);
  if (existing) return existing;

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .insert({
      restaurant_id: params.restaurantId,
      name: trimmed,
      unit: params.unit,
      item_type: "ingredient",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existingRow } = await supabaseServer
        .from("inventory_items")
        .select("id")
        .eq("restaurant_id", params.restaurantId)
        .ilike("name", trimmed)
        .limit(1)
        .maybeSingle();
      if (existingRow) {
        const id = (existingRow as { id: string }).id;
        params.nameToId.set(key, id);
        return id;
      }
    }
    return null;
  }

  const id = (data as { id: string }).id;
  params.nameToId.set(key, id);
  return id;
}

export async function applyOnboardingRecipeSuggestions(
  rows: RecipeImportPayload[]
): Promise<ApplyRecipeImportResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const selected = rows.filter((row) => row.selected && row.dish_name.trim() && row.ingredients.length > 0);
  if (selected.length === 0) {
    return { ok: true, applied: 0, replaced: 0, skipped: 0, errors: [] };
  }

  const [{ data: dishes, error: dishesError }, { data: items }] = await Promise.all([
    getDishes(restaurant.id),
    getInventoryItems(restaurant.id),
  ]);
  if (dishesError || !dishes) {
    return {
      ok: false,
      applied: 0,
      replaced: 0,
      skipped: 0,
      errors: [dishesError?.message ?? "Impossible de charger les plats."],
    };
  }

  const dishByNorm = new Map(dishes.map((dish) => [dish.name_normalized ?? normalizeDishLabel(dish.name), dish]));
  const targetDishIds = selected
    .map((row) => dishByNorm.get(row.normalized_label || normalizeDishLabel(row.dish_name))?.id)
    .filter((id): id is string => Boolean(id));

  const existingComponentDishIds = new Set<string>();
  if (targetDishIds.length > 0) {
    const { data: existingComps } = await supabaseServer
      .from("dish_components")
      .select("dish_id")
      .eq("restaurant_id", restaurant.id)
      .in("dish_id", targetDishIds);
    for (const comp of existingComps ?? []) {
      existingComponentDishIds.add((comp as { dish_id: string }).dish_id);
    }
  }

  const nameToId = new Map<string, string>(
    (items ?? []).map((item) => [normalizeInventoryItemName(item.name), item.id])
  );

  let applied = 0;
  let replaced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of selected) {
    const normalized = row.normalized_label || normalizeDishLabel(row.dish_name);
    const dish = dishByNorm.get(normalized);
    if (!dish) {
      skipped++;
      errors.push(`${row.dish_name}: plat introuvable dans la carte.`);
      continue;
    }
    if (existingComponentDishIds.has(dish.id)) {
      if (dish.recipe_status === "validated") {
        skipped++;
        errors.push(`${dish.name}: recette déjà validée, ignorée.`);
        continue;
      }

      const { error: deleteErr } = await supabaseServer
        .from("dish_components")
        .delete()
        .eq("restaurant_id", restaurant.id)
        .eq("dish_id", dish.id);
      if (deleteErr) {
        skipped++;
        errors.push(`${dish.name}: impossible de remplacer la recette brouillon (${deleteErr.message}).`);
        continue;
      }
      existingComponentDishIds.delete(dish.id);
      replaced++;
    }

    const componentRows: { restaurant_id: string; dish_id: string; inventory_item_id: string; qty: number }[] = [];
    for (const ingredient of row.ingredients) {
      const name = ingredient.name.trim();
      if (!name) continue;
      if (ingredient.unit && !parseAllowedStockUnit(ingredient.unit)) {
        errors.push(`${dish.name}: unité non autorisée pour "${name}". Utilisez : ${ALLOWED_STOCK_UNITS_HELP_FR}.`);
        continue;
      }
      const qty =
        ingredient.qty != null && Number.isFinite(Number(ingredient.qty)) && Number(ingredient.qty) > 0
          ? Math.round(Number(ingredient.qty) * 1000) / 1000
          : 1;
      const id = await getOrCreateIngredient({
        restaurantId: restaurant.id,
        name,
        unit: normalizeUnit(ingredient.unit),
        nameToId,
      });
      if (!id) {
        errors.push(`${dish.name}: impossible de créer "${name}".`);
        continue;
      }
      componentRows.push({
        restaurant_id: restaurant.id,
        dish_id: dish.id,
        inventory_item_id: id,
        qty,
      });
    }

    if (componentRows.length === 0) {
      skipped++;
      continue;
    }

    const { error: insertErr } = await supabaseServer.from("dish_components").insert(componentRows);
    if (insertErr) {
      skipped++;
      errors.push(`${dish.name}: ${insertErr.message}`);
      continue;
    }

    await supabaseServer
      .from("dishes")
      .update({ production_mode: "prepared", recipe_status: "draft" })
      .eq("id", dish.id)
      .eq("restaurant_id", restaurant.id);
    existingComponentDishIds.add(dish.id);
    applied++;
  }

  revalidatePath("/dishes");
  revalidatePath("/inventory");
  revalidatePath("/margins", "page");
  return { ok: errors.length === 0 || applied > 0, applied, replaced, skipped, errors };
}
