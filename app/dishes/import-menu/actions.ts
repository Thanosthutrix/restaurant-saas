"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getDishes, createDish, getInventoryItems } from "@/lib/db";
import { normalizeVatRatePct } from "@/lib/tax/frenchSellingVat";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { supabaseServer } from "@/lib/supabaseServer";

export type CreateFromMenuPayload = {
  raw_label: string;
  selected: boolean;
  suggested_mode: "prepared" | "resale" | "ignore";
  /** Prix de vente TTC carte (€), optionnel. */
  selling_price_ttc?: number | null;
  /** Taux TVA % (ex. 10, 20). */
  selling_vat_rate_pct?: number | null;
  /** Ingrédients validés par l’utilisateur (libellés). Vide si pas de recette brouillon. */
  suggested_ingredients: string[];
  /** Créer une recette brouillon (composants avec qty = 1) pour les plats prepared. */
  create_draft_recipe: boolean;
};

export type CreateFromMenuResult = {
  success: boolean;
  created: number;
  skipped: number;
  draftRecipes: number;
  errors: string[];
};

/**
 * Find-or-create inventory_item (ingredient, unit "unit"). Retourne l’id.
 * En cas de conflit d’unicité (nom déjà existant), récupère l’id existant.
 */
async function getOrCreateIngredient(
  restaurantId: string,
  name: string,
  nameToId: Map<string, string>
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const key = normalizeInventoryItemName(trimmed);
  const existing = nameToId.get(key);
  if (existing) return existing;

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .insert({
      restaurant_id: restaurantId,
      name: trimmed,
      unit: "unit",
      item_type: "ingredient",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existingRow } = await supabaseServer
        .from("inventory_items")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .ilike("name", trimmed)
        .limit(1)
        .maybeSingle();
      if (existingRow) {
        const id = (existingRow as { id: string }).id;
        nameToId.set(key, id);
        return id;
      }
    }
    return null;
  }
  if (!data) return null;
  const id = (data as { id: string }).id;
  nameToId.set(key, id);
  return id;
}

/** Normalise un item du payload (sérialisation client peut varier). */
function normalizePayloadItem(item: CreateFromMenuPayload): CreateFromMenuPayload {
  const suggested_ingredients = Array.isArray(item.suggested_ingredients)
    ? item.suggested_ingredients.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0)
    : [];
  const create_draft_recipe = item.create_draft_recipe === true;
  let selling_price_ttc: number | null = null;
  const rawTtc = item.selling_price_ttc ?? (item as { selling_price_ht?: unknown }).selling_price_ht;
  if (typeof rawTtc === "number" && Number.isFinite(rawTtc) && rawTtc >= 0) {
    selling_price_ttc = Math.round(rawTtc * 100) / 100;
  }
  const mode =
    item.suggested_mode === "resale" ? "resale" : item.suggested_mode === "ignore" ? "ignore" : "prepared";
  const selling_vat_rate_pct = normalizeVatRatePct(
    item.selling_vat_rate_pct ?? (mode === "resale" ? 20 : 10),
    mode === "resale" ? 20 : 10
  );
  return {
    raw_label: typeof item.raw_label === "string" ? item.raw_label.trim() : "",
    selected: item.selected === true,
    suggested_mode: mode,
    selling_price_ttc,
    selling_vat_rate_pct,
    suggested_ingredients,
    create_draft_recipe,
  };
}

/**
 * Crée les plats sélectionnés dans le restaurant courant.
 * - Ne crée pas les éléments non cochés ou en mode ignore.
 * - Vérifie les doublons via name_normalized.
 * - Si create_draft_recipe et suggested_ingredients non vide (prepared), crée les dish_components (qty = 1) et met recipe_status = draft.
 * - Les recettes brouillon ne sont pas utilisées pour le stock tant qu’elles ne sont pas validées (recipe_status = validated).
 */
export async function createDishesFromMenuSuggestions(
  items: CreateFromMenuPayload[]
): Promise<CreateFromMenuResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const normalizedItems = items.map(normalizePayloadItem);

  const { data: existingDishes, error: fetchError } = await getDishes(restaurant.id);
  if (fetchError || !existingDishes) {
    return { success: false, created: 0, skipped: 0, draftRecipes: 0, errors: [fetchError?.message ?? "Impossible de charger les plats."] };
  }

  const existingNormalized = new Set(
    existingDishes
      .map((d) => d.name_normalized)
      .filter((n): n is string => !!n && n.length > 0)
  );

  const { data: existingItems } = await getInventoryItems(restaurant.id);
  const nameToId = new Map<string, string>(
    (existingItems ?? []).map((i) => [normalizeInventoryItemName(i.name), i.id])
  );

  let created = 0;
  let skipped = 0;
  let draftRecipes = 0;
  const errors: string[] = [];
  const createdDishIds: string[] = [];

  for (const item of normalizedItems) {
    if (!item.selected || item.suggested_mode === "ignore") continue;

    const name = item.raw_label;
    if (!name) continue;

    const nameNorm = normalizeDishLabel(name);
    if (existingNormalized.has(nameNorm)) {
      skipped++;
      continue;
    }

    const mode = item.suggested_mode === "resale" ? "resale" : "prepared";
    const priceTtc =
      item.selling_price_ttc != null && Number.isFinite(item.selling_price_ttc) && item.selling_price_ttc > 0
        ? item.selling_price_ttc
        : null;
    const vat = normalizeVatRatePct(item.selling_vat_rate_pct, mode === "resale" ? 20 : 10);
    const { data: dish, error } = await createDish(restaurant.id, name, mode, priceTtc, vat);
    if (error || !dish) {
      errors.push(`${name}: ${error?.message ?? "création impossible"}`);
      continue;
    }
    created++;
    existingNormalized.add(dish.name_normalized ?? normalizeDishLabel(name));
    createdDishIds.push(dish.id);

    const wantDraftRecipe =
      mode === "prepared" &&
      item.create_draft_recipe === true &&
      item.suggested_ingredients.length > 0;

    if (wantDraftRecipe) {
      const ids: string[] = [];
      for (const ing of item.suggested_ingredients) {
        const id = await getOrCreateIngredient(restaurant.id, ing, nameToId);
        if (id) ids.push(id);
      }
      for (const inventoryItemId of ids) {
        const { error: insertErr } = await supabaseServer.from("dish_components").insert({
          restaurant_id: restaurant.id,
          dish_id: dish.id,
          inventory_item_id: inventoryItemId,
          qty: 1,
        });
        if (insertErr) {
          errors.push(`${name}: composant ${insertErr.message}`);
        }
      }
      if (ids.length > 0) {
        await supabaseServer
          .from("dishes")
          .update({ recipe_status: "draft" })
          .eq("id", dish.id)
          .eq("restaurant_id", restaurant.id);
        draftRecipes++;
      }
    }
  }

  revalidatePath("/dishes");
  for (const id of createdDishIds) {
    revalidatePath(`/dishes/${id}`, "page");
  }
  revalidatePath("/inventory");

  return { success: true, created, skipped, draftRecipes, errors };
}
