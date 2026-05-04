"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listRestaurantCategories } from "@/lib/catalog/restaurantCategories";
import { getInventoryItems } from "@/lib/db";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { supabaseServer } from "@/lib/supabaseServer";

export type IngredientCategoryAssignmentPayload = {
  selected: boolean;
  ingredient_name: string;
  normalized_label: string;
  suggested_category: string;
};

export type ApplyIngredientCategoryAssignmentsResult = {
  ok: boolean;
  createdCategories: number;
  assignedItems: number;
  skipped: number;
  errors: string[];
};

function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

async function getOrCreateInventoryCategory(params: {
  restaurantId: string;
  name: string;
  categoryByName: Map<string, { id: string; applies_to: "dish" | "inventory" | "both" }>;
  /** Tous les composants à classer sont en revente : mêmes rubriques que la carte. */
  inventoryResaleOnly: boolean;
}): Promise<{ id: string; created: boolean; error?: string }> {
  const key = normalizeCategoryName(params.name);
  const existing = params.categoryByName.get(key);
  if (existing) {
    if (existing.applies_to === "dish") {
      const { error } = await supabaseServer
        .from("restaurant_categories")
        .update({ applies_to: "both" })
        .eq("id", existing.id)
        .eq("restaurant_id", params.restaurantId);
      if (error) return { id: existing.id, created: false, error: error.message };
      existing.applies_to = "both";
    } else if (params.inventoryResaleOnly && existing.applies_to === "inventory") {
      const { error } = await supabaseServer
        .from("restaurant_categories")
        .update({ applies_to: "both" })
        .eq("id", existing.id)
        .eq("restaurant_id", params.restaurantId);
      if (error) return { id: existing.id, created: false, error: error.message };
      existing.applies_to = "both";
    }
    return { id: existing.id, created: false };
  }

  const appliesTo = params.inventoryResaleOnly ? "both" : "inventory";
  const { data, error } = await supabaseServer
    .from("restaurant_categories")
    .insert({
      restaurant_id: params.restaurantId,
      parent_id: null,
      name: params.name.trim(),
      applies_to: appliesTo,
      sort_order: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { id: "", created: false, error: error?.message ?? "Création de rubrique impossible." };
  }

  const id = (data as { id: string }).id;
  params.categoryByName.set(key, { id, applies_to: appliesTo });
  return { id, created: true };
}

export async function applyOnboardingIngredientCategoryAssignments(
  rows: IngredientCategoryAssignmentPayload[]
): Promise<ApplyIngredientCategoryAssignmentsResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const selected = rows
    .map((row) => ({
      selected: row.selected === true,
      ingredient_name: typeof row.ingredient_name === "string" ? row.ingredient_name.trim() : "",
      normalized_label:
        typeof row.normalized_label === "string" && row.normalized_label.trim()
          ? normalizeInventoryItemName(row.normalized_label)
          : normalizeInventoryItemName(row.ingredient_name ?? ""),
      suggested_category:
        typeof row.suggested_category === "string" ? row.suggested_category.trim().replace(/\s+/g, " ") : "",
    }))
    .filter((row) => row.selected && row.ingredient_name && row.suggested_category);

  if (selected.length === 0) {
    return { ok: true, createdCategories: 0, assignedItems: 0, skipped: 0, errors: [] };
  }

  const [{ data: items, error: itemsError }, { data: categories, error: categoriesError }] = await Promise.all([
    getInventoryItems(restaurant.id),
    listRestaurantCategories(restaurant.id),
  ]);

  if (itemsError || !items) {
    return {
      ok: false,
      createdCategories: 0,
      assignedItems: 0,
      skipped: 0,
      errors: [itemsError?.message ?? "Impossible de charger les composants stock."],
    };
  }
  if (categoriesError) {
    return {
      ok: false,
      createdCategories: 0,
      assignedItems: 0,
      skipped: 0,
      errors: [categoriesError.message],
    };
  }

  const itemByNorm = new Map(
    items.map((item) => [normalizeInventoryItemName(item.name), item])
  );
  const categoryByName = new Map(
    categories.map((category) => [
      normalizeCategoryName(category.name),
      { id: category.id, applies_to: category.applies_to },
    ])
  );

  const inventoryResaleOnly =
    selected.length > 0 &&
    selected.every((row) => {
      const inv = itemByNorm.get(row.normalized_label);
      return inv != null && inv.item_type === "resale";
    });

  let createdCategories = 0;
  let assignedItems = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of selected) {
    const inv = itemByNorm.get(row.normalized_label);
    if (!inv) {
      skipped++;
      errors.push(`${row.ingredient_name}: composant introuvable (créez-le depuis une recette ou le stock).`);
      continue;
    }

    const category = await getOrCreateInventoryCategory({
      restaurantId: restaurant.id,
      name: row.suggested_category,
      categoryByName,
      inventoryResaleOnly,
    });
    if (category.error || !category.id) {
      skipped++;
      errors.push(`${row.suggested_category}: ${category.error ?? "rubrique impossible"}`);
      continue;
    }
    if (category.created) createdCategories++;

    const { error } = await supabaseServer
      .from("inventory_items")
      .update({ category_id: category.id })
      .eq("id", inv.id)
      .eq("restaurant_id", restaurant.id);

    if (error) {
      skipped++;
      errors.push(`${inv.name}: ${error.message}`);
      continue;
    }
    assignedItems++;
  }

  revalidatePath("/inventory");
  revalidatePath("/dishes");
  revalidatePath("/account");

  return {
    ok: errors.length === 0 || assignedItems > 0,
    createdCategories,
    assignedItems,
    skipped,
    errors,
  };
}
