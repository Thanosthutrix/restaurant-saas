"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { parseAllowedStockUnit, type AllowedUnit } from "@/lib/constants";
import { getInventoryItems } from "@/lib/db";
import { scaleRecipeQuantitiesWhenStockUnitChanges } from "@/lib/inventory/scaleRecipeQuantitiesWhenStockUnitChanges";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { getCalculatedStockForSingleItem } from "@/lib/stock/stockMovements";
import { roundRecipeQty, stockUnitQtyScaleFactor } from "@/lib/units/stockUnitConversion";
import { supabaseServer } from "@/lib/supabaseServer";
import { applyBenchmarkTariffByProductIdAction } from "@/app/inventory/actions";
import {
  listBenchmarkTariffSuggestions,
  type BenchmarkSuggestion,
} from "@/lib/benchmarkTariffFr";

export type OnboardingBenchmarkChoice = {
  benchmarkProductId: string;
  produitLabel: string;
  famille: string;
  price: number;
  catalogMeanEuroHt: number;
  catalogNormalizedUnit: string;
};

function collectOnboardingBenchmarkChoices(name: string, stockUnit: AllowedUnit): OnboardingBenchmarkChoice[] {
  const itemType = "ingredient" as const;
  const toChoice = (s: BenchmarkSuggestion[]): OnboardingBenchmarkChoice[] =>
    s.map(({ productId, produitLabel, famille, price, catalogMeanEuroHt, catalogNormalizedUnit }) => ({
      benchmarkProductId: productId,
      produitLabel,
      famille,
      price,
      catalogMeanEuroHt,
      catalogNormalizedUnit,
    }));

  let rows = listBenchmarkTariffSuggestions(name, itemType, stockUnit, { limit: 14, minScore: 0.08 });
  if (rows.length < 5) {
    rows = listBenchmarkTariffSuggestions(name, itemType, stockUnit, { limit: 14, minScore: 0.045 });
  }
  if (rows.length === 0) {
    rows = listBenchmarkTariffSuggestions(name, itemType, stockUnit, { limit: 14, minScore: 0.018 });
  }
  return toChoice(rows);
}

/** Propositions base indicative France pour un nom + unité (nouvel ingrédient à l’onboarding). */
export async function loadOnboardingBenchmarkSuggestionsAction(params: {
  name: string;
  unit: AllowedUnit;
}): Promise<{ ok: true; data: OnboardingBenchmarkChoice[] } | { ok: false; error: string }> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) return { ok: false, error: "Restaurant introuvable." };
  const name = params.name?.trim();
  if (!name) return { ok: true, data: [] };
  return { ok: true, data: collectOnboardingBenchmarkChoices(name, params.unit) };
}

export type PurchasePriceApplyPayload = {
  selected: boolean;
  label: string;
  inventory_item_id: string | null;
  create_inventory_item_name: string | null;
  unit: AllowedUnit | null;
  reference_purchase_unit_cost_ht: number | null;
  supplier_id: string | null;
  /** Libellé conditionnement sur la facture (sac, carton, colis…). */
  purchase_unit: string | null;
  /** Quantité d’unité de stock pour 1 unité livrée facturée (même règle que le pointage BL). */
  units_per_purchase: number | null;
  /**
   * Si renseigné : après création d’un **nouvel** ingrédient, applique d’abord la ligne base France (indicatif),
   * puis le prix facture remplace comme référence réelle (hors benchmark).
   */
  benchmark_product_id: string | null;
};

export type ApplyPurchasePricesResult = {
  ok: boolean;
  updated: number;
  created: number;
  skipped: number;
  errors: string[];
};

function roundUnitPrice(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

async function getOrCreateInventoryItem(params: {
  restaurantId: string;
  inventoryItemId: string | null;
  name: string | null;
  unit: AllowedUnit;
  supplierId: string | null;
  createdCounter: { value: number };
}): Promise<{ id: string | null; error?: string; wasNewlyCreated?: boolean }> {
  if (params.inventoryItemId) {
    const { data, error } = await supabaseServer
      .from("inventory_items")
      .select("id")
      .eq("id", params.inventoryItemId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    if (!data) return { id: null, error: "Ingrédient introuvable." };
    return { id: params.inventoryItemId, wasNewlyCreated: false };
  }

  const name = params.name?.trim();
  if (!name) return { id: null, error: "Choisissez un ingrédient ou saisissez un nom à créer." };
  const normalized = normalizeInventoryItemName(name);
  const existing = await getInventoryItems(params.restaurantId);
  const found = (existing.data ?? []).find((item) => normalizeInventoryItemName(item.name) === normalized);
  if (found) return { id: found.id, wasNewlyCreated: false };

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .insert({
      restaurant_id: params.restaurantId,
      name,
      unit: params.unit,
      item_type: "ingredient",
      supplier_id: params.supplierId,
      reference_purchase_unit_cost_ht: null,
    })
    .select("id")
    .single();
  if (error || !data) return { id: null, error: error?.message ?? "Création ingrédient impossible." };
  params.createdCounter.value++;
  return { id: (data as { id: string }).id, wasNewlyCreated: true };
}

export async function applyOnboardingPurchasePrices(
  rows: PurchasePriceApplyPayload[]
): Promise<ApplyPurchasePricesResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const selected = rows.filter((row) => row.selected);
  if (selected.length === 0) return { ok: true, updated: 0, created: 0, skipped: 0, errors: [] };

  let updated = 0;
  let skipped = 0;
  const createdCounter = { value: 0 };
  const errors: string[] = [];

  for (const row of selected) {
    const price =
      row.reference_purchase_unit_cost_ht != null &&
      Number.isFinite(Number(row.reference_purchase_unit_cost_ht)) &&
      Number(row.reference_purchase_unit_cost_ht) > 0
        ? roundUnitPrice(Number(row.reference_purchase_unit_cost_ht))
        : null;
    if (price == null) {
      skipped++;
      errors.push(`${row.label}: prix HT/unité invalide.`);
      continue;
    }

    const unit = row.unit ? parseAllowedStockUnit(row.unit) : "unit";
    if (!unit) {
      skipped++;
      errors.push(`${row.label}: unité invalide.`);
      continue;
    }

    const item = await getOrCreateInventoryItem({
      restaurantId: restaurant.id,
      inventoryItemId: row.inventory_item_id || null,
      name: row.create_inventory_item_name,
      unit,
      supplierId: row.supplier_id || null,
      createdCounter,
    });
    if (!item.id) {
      skipped++;
      errors.push(`${row.label}: ${item.error ?? "ingrédient impossible"}`);
      continue;
    }

    const benchId = typeof row.benchmark_product_id === "string" ? row.benchmark_product_id.trim() : "";
    if (item.wasNewlyCreated && benchId) {
      const benchRes = await applyBenchmarkTariffByProductIdAction({
        itemId: item.id,
        restaurantId: restaurant.id,
        benchmarkProductId: benchId,
      });
      if (!benchRes.ok) {
        errors.push(`${row.label} (base indicative) : ${benchRes.error}`);
      }
    }

    const { data: curRow, error: curErr } = await supabaseServer
      .from("inventory_items")
      .select("unit, current_stock_qty, min_stock_qty, target_stock_qty")
      .eq("id", item.id)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();

    if (curErr || !curRow) {
      skipped++;
      errors.push(`${row.label}: ${curErr?.message ?? "lecture composant impossible."}`);
      continue;
    }

    const cur = curRow as {
      unit: string;
      current_stock_qty: unknown;
      min_stock_qty: unknown;
      target_stock_qty: unknown;
    };

    const oldCanon = parseAllowedStockUnit(String(cur.unit ?? ""));
    const newCanon = unit;

    const patch: Record<string, unknown> = {
      reference_purchase_unit_cost_ht: price,
      reference_purchase_is_benchmark: false,
      unit: newCanon,
    };
    if (row.supplier_id) patch.supplier_id = row.supplier_id;

    const pu = typeof row.purchase_unit === "string" ? row.purchase_unit.trim() : "";
    if (pu) patch.purchase_unit = pu;

    const ratioRaw = row.units_per_purchase;
    const ratio =
      ratioRaw != null && Number.isFinite(Number(ratioRaw)) && Number(ratioRaw) > 0 ? Number(ratioRaw) : null;
    if (ratio != null) patch.units_per_purchase = ratio;

    if (oldCanon && newCanon && oldCanon !== newCanon) {
      const factor = stockUnitQtyScaleFactor(oldCanon, newCanon);
      if (factor == null) {
        skipped++;
        errors.push(
          `${row.label}: pas de conversion automatique entre « ${oldCanon} » et « ${newCanon} ». Utilisez des unités compatibles (g ↔ kg, ml ↔ l) ou modifiez l’unité depuis la fiche composant.`
        );
        continue;
      }
      if (factor !== 1) {
        const scaled = await scaleRecipeQuantitiesWhenStockUnitChanges({
          restaurantId: restaurant.id,
          inventoryItemId: item.id,
          factor,
        });
        if (scaled.error) {
          skipped++;
          errors.push(`${row.label}: ${scaled.error}`);
          continue;
        }

        const calc = await getCalculatedStockForSingleItem(restaurant.id, item.id);
        const baseQty = calc.error
          ? Number(cur.current_stock_qty)
          : calc.qty;
        const b = Number.isFinite(baseQty) ? baseQty : 0;
        patch.current_stock_qty = roundRecipeQty(b * factor);

        const oldM = cur.min_stock_qty;
        if (oldM != null && oldM !== "") {
          const m = Number(oldM);
          if (Number.isFinite(m) && m >= 0) {
            patch.min_stock_qty = roundRecipeQty(m * factor);
          }
        }
        const oldT = cur.target_stock_qty;
        if (oldT != null && oldT !== "") {
          const t = Number(oldT);
          if (Number.isFinite(t) && t >= 0) {
            patch.target_stock_qty = roundRecipeQty(t * factor);
          }
        }
      }
    }

    const { error } = await supabaseServer
      .from("inventory_items")
      .update(patch)
      .eq("id", item.id)
      .eq("restaurant_id", restaurant.id);
    if (error) {
      skipped++;
      errors.push(`${row.label}: ${error.message}`);
      continue;
    }
    updated++;
  }

  revalidatePath("/inventory");
  revalidatePath("/margins");
  revalidatePath("/dishes/[id]", "page");
  revalidatePath("/dashboard");

  return {
    ok: errors.length === 0 || updated > 0,
    updated,
    created: createdCounter.value,
    skipped,
    errors,
  };
}
