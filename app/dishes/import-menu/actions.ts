"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getDishes, createDish } from "@/lib/db";
import { normalizeVatRatePct, sellingPriceHtFromTtc } from "@/lib/tax/frenchSellingVat";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import { supabaseServer } from "@/lib/supabaseServer";

export type CreateFromMenuPayload = {
  raw_label: string;
  selected: boolean;
  suggested_mode: "prepared" | "resale" | "ignore";
  /** Prix de vente TTC carte (€), optionnel. */
  selling_price_ttc?: number | null;
  /** Taux TVA % (ex. 10, 20). */
  selling_vat_rate_pct?: number | null;
  /** Ancien champ conservé pour compatibilité client. Ignoré par l'import carte. */
  suggested_ingredients: string[];
  /** Ancien champ conservé pour compatibilité client. Ignoré par l'import carte. */
  create_draft_recipe: boolean;
};

export type CreateFromMenuResult = {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  draftRecipes: number;
  errors: string[];
};

/** Normalise un item du payload (sérialisation client peut varier). */
function normalizePayloadItem(item: CreateFromMenuPayload): CreateFromMenuPayload {
  const suggested_ingredients = Array.isArray(item.suggested_ingredients)
    ? item.suggested_ingredients.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0)
    : [];
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
    create_draft_recipe: false,
  };
}

/**
 * Synchronise les plats sélectionnés dans le restaurant courant.
 * - Ne crée pas les éléments non cochés ou en mode ignore.
 * - Vérifie les doublons via name_normalized et met à jour les plats déjà existants.
 * - Ne touche jamais aux recettes ni aux composants : l'analyse dédiée recettes est seule responsable de ces données.
 */
export async function createDishesFromMenuSuggestions(
  items: CreateFromMenuPayload[]
): Promise<CreateFromMenuResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const normalizedItems = items.map(normalizePayloadItem);

  const { data: existingDishes, error: fetchError } = await getDishes(restaurant.id);
  if (fetchError || !existingDishes) {
    return { success: false, created: 0, updated: 0, skipped: 0, draftRecipes: 0, errors: [fetchError?.message ?? "Impossible de charger les plats."] };
  }

  const dishByNormalized = new Map(
    existingDishes
      .map((d) => [d.name_normalized ?? normalizeDishLabel(d.name), d] as const)
      .filter(([n]) => n.length > 0)
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const draftRecipes = 0;
  const errors: string[] = [];
  const touchedDishIds: string[] = [];

  for (const item of normalizedItems) {
    if (!item.selected || item.suggested_mode === "ignore") continue;

    const name = item.raw_label;
    if (!name) continue;

    const nameNorm = normalizeDishLabel(name);
    const mode = item.suggested_mode === "resale" ? "resale" : "prepared";
    const priceTtc =
      item.selling_price_ttc != null && Number.isFinite(item.selling_price_ttc) && item.selling_price_ttc > 0
        ? item.selling_price_ttc
        : null;
    const vat = normalizeVatRatePct(item.selling_vat_rate_pct, mode === "resale" ? 20 : 10);

    const existingDish = dishByNormalized.get(nameNorm);
    if (existingDish) {
      const patch: {
        production_mode?: "prepared" | "resale";
        selling_price_ttc?: number;
        selling_price_ht?: number;
        selling_vat_rate_pct?: number;
      } = {};

      if (existingDish.production_mode !== mode) {
        patch.production_mode = mode;
      }
      if (priceTtc != null) {
        patch.selling_price_ttc = priceTtc;
        patch.selling_vat_rate_pct = vat;
        patch.selling_price_ht = sellingPriceHtFromTtc(priceTtc, vat);
      } else if (
        existingDish.selling_price_ttc != null &&
        Number.isFinite(existingDish.selling_price_ttc) &&
        existingDish.selling_price_ttc > 0 &&
        existingDish.selling_vat_rate_pct !== vat
      ) {
        patch.selling_vat_rate_pct = vat;
        patch.selling_price_ht = sellingPriceHtFromTtc(existingDish.selling_price_ttc, vat);
      }

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      const { error: updateErr } = await supabaseServer
        .from("dishes")
        .update(patch)
        .eq("id", existingDish.id)
        .eq("restaurant_id", restaurant.id);

      if (updateErr) {
        errors.push(`${name}: mise à jour impossible (${updateErr.message})`);
        continue;
      }
      updated++;
      touchedDishIds.push(existingDish.id);
      continue;
    }

    const { data: dish, error } = await createDish(restaurant.id, name, mode, priceTtc, vat);
    if (error || !dish) {
      errors.push(`${name}: ${error?.message ?? "création impossible"}`);
      continue;
    }
    created++;
    dishByNormalized.set(dish.name_normalized ?? normalizeDishLabel(name), dish);
    touchedDishIds.push(dish.id);
  }

  revalidatePath("/dishes");
  for (const id of touchedDishIds) {
    revalidatePath(`/dishes/${id}`, "page");
  }

  return { success: true, created, updated, skipped, draftRecipes, errors };
}
