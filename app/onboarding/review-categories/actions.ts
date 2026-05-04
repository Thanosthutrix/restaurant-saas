"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listRestaurantCategories } from "@/lib/catalog/restaurantCategories";
import { getDishes } from "@/lib/db";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import { syncResaleInventoryCategoryFromDish } from "@/lib/recipes/syncResaleInventoryCategoryFromDish";
import { supabaseServer } from "@/lib/supabaseServer";

export type CategoryAssignmentPayload = {
  selected: boolean;
  dish_name: string;
  normalized_label: string;
  suggested_category: string;
};

export type ApplyCategoryAssignmentsResult = {
  ok: boolean;
  createdCategories: number;
  assignedDishes: number;
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

async function getOrCreateDishCategory(params: {
  restaurantId: string;
  name: string;
  categoryByName: Map<string, { id: string; applies_to: "dish" | "inventory" | "both" }>;
  /** Tous les plats à classer sont en revente : une seule arborescence de rubriques pour carte et stock. */
  catalogResaleOnly: boolean;
}): Promise<{ id: string; created: boolean; error?: string }> {
  const key = normalizeCategoryName(params.name);
  const existing = params.categoryByName.get(key);
  if (existing) {
    if (existing.applies_to === "inventory") {
      const { error } = await supabaseServer
        .from("restaurant_categories")
        .update({ applies_to: "both" })
        .eq("id", existing.id)
        .eq("restaurant_id", params.restaurantId);
      if (error) return { id: existing.id, created: false, error: error.message };
      existing.applies_to = "both";
    } else if (params.catalogResaleOnly && existing.applies_to === "dish") {
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

  const appliesTo = params.catalogResaleOnly ? "both" : "dish";
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

export async function applyOnboardingCategoryAssignments(
  rows: CategoryAssignmentPayload[]
): Promise<ApplyCategoryAssignmentsResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const selected = rows
    .map((row) => ({
      selected: row.selected === true,
      dish_name: typeof row.dish_name === "string" ? row.dish_name.trim() : "",
      normalized_label:
        typeof row.normalized_label === "string" && row.normalized_label.trim()
          ? normalizeDishLabel(row.normalized_label)
          : normalizeDishLabel(row.dish_name ?? ""),
      suggested_category:
        typeof row.suggested_category === "string" ? row.suggested_category.trim().replace(/\s+/g, " ") : "",
    }))
    .filter((row) => row.selected && row.dish_name && row.suggested_category);

  if (selected.length === 0) {
    return { ok: true, createdCategories: 0, assignedDishes: 0, skipped: 0, errors: [] };
  }

  const [{ data: dishes, error: dishesError }, { data: categories, error: categoriesError }] =
    await Promise.all([getDishes(restaurant.id), listRestaurantCategories(restaurant.id)]);

  if (dishesError || !dishes) {
    return {
      ok: false,
      createdCategories: 0,
      assignedDishes: 0,
      skipped: 0,
      errors: [dishesError?.message ?? "Impossible de charger les plats."],
    };
  }
  if (categoriesError) {
    return {
      ok: false,
      createdCategories: 0,
      assignedDishes: 0,
      skipped: 0,
      errors: [categoriesError.message],
    };
  }

  const dishByNorm = new Map(dishes.map((dish) => [dish.name_normalized ?? normalizeDishLabel(dish.name), dish]));
  const categoryByName = new Map(
    categories.map((category) => [
      normalizeCategoryName(category.name),
      { id: category.id, applies_to: category.applies_to },
    ])
  );

  const catalogResaleOnly =
    selected.length > 0 &&
    selected.every((row) => {
      const dish = dishByNorm.get(row.normalized_label) ?? dishByNorm.get(normalizeDishLabel(row.dish_name));
      return dish?.production_mode === "resale";
    });

  let createdCategories = 0;
  let assignedDishes = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of selected) {
    const dish = dishByNorm.get(row.normalized_label) ?? dishByNorm.get(normalizeDishLabel(row.dish_name));
    if (!dish) {
      skipped++;
      errors.push(`${row.dish_name}: plat introuvable.`);
      continue;
    }

    const category = await getOrCreateDishCategory({
      restaurantId: restaurant.id,
      name: row.suggested_category,
      categoryByName,
      catalogResaleOnly,
    });
    if (category.error || !category.id) {
      skipped++;
      errors.push(`${row.suggested_category}: ${category.error ?? "rubrique impossible"}`);
      continue;
    }
    if (category.created) createdCategories++;

    const { error } = await supabaseServer
      .from("dishes")
      .update({ category_id: category.id })
      .eq("id", dish.id)
      .eq("restaurant_id", restaurant.id);

    if (error) {
      skipped++;
      errors.push(`${dish.name}: ${error.message}`);
      continue;
    }
    assignedDishes++;

    if (dish.production_mode === "resale") {
      const sync = await syncResaleInventoryCategoryFromDish(restaurant.id, dish.id);
      if (sync.error) {
        errors.push(`${dish.name}: rubrique stock — ${sync.error.message}`);
      }
    }
  }

  revalidatePath("/dishes");
  revalidatePath("/inventory");
  revalidatePath("/salle");
  revalidatePath("/caisse");
  revalidatePath("/account");

  return {
    ok: errors.length === 0 || assignedDishes > 0,
    createdCategories,
    assignedDishes,
    skipped,
    errors,
  };
}
