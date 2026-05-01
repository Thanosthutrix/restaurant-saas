"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { parseAllowedStockUnit, type AllowedUnit } from "@/lib/constants";
import { getInventoryItems } from "@/lib/db";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { supabaseServer } from "@/lib/supabaseServer";

export type PurchasePriceApplyPayload = {
  selected: boolean;
  label: string;
  inventory_item_id: string | null;
  create_inventory_item_name: string | null;
  unit: AllowedUnit | null;
  reference_purchase_unit_cost_ht: number | null;
  supplier_id: string | null;
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
}): Promise<{ id: string | null; error?: string }> {
  if (params.inventoryItemId) {
    const { data, error } = await supabaseServer
      .from("inventory_items")
      .select("id")
      .eq("id", params.inventoryItemId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    if (!data) return { id: null, error: "Ingrédient introuvable." };
    return { id: params.inventoryItemId };
  }

  const name = params.name?.trim();
  if (!name) return { id: null, error: "Choisissez un ingrédient ou saisissez un nom à créer." };
  const normalized = normalizeInventoryItemName(name);
  const existing = await getInventoryItems(params.restaurantId);
  const found = (existing.data ?? []).find((item) => normalizeInventoryItemName(item.name) === normalized);
  if (found) return { id: found.id };

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
  return { id: (data as { id: string }).id };
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

    const patch: Record<string, unknown> = {
      reference_purchase_unit_cost_ht: price,
      updated_at: new Date().toISOString(),
    };
    if (row.supplier_id) patch.supplier_id = row.supplier_id;

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
