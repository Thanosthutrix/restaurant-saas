import { supabaseServer } from "@/lib/supabaseServer";
import { computeDeliveryLabelCore } from "@/lib/matching/deliveryLabelCore";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import type { SavedBlConversionHint } from "@/lib/receiving/blStockConversion";

/** Clés : libellé BL normalisé complet + cœur (sans codes packaging). */
export async function fetchDeliveryLabelAliasMap(
  restaurantId: string,
  supplierId: string
): Promise<Map<string, string>> {
  const { data: rows, error } = await supabaseServer
    .from("inventory_delivery_label_aliases")
    .select("label_normalized, label_core, inventory_item_id")
    .eq("restaurant_id", restaurantId)
    .eq("supplier_id", supplierId);

  if (error) {
    console.warn("[inventory_delivery_label_aliases]", error.message);
    return new Map();
  }

  const map = new Map<string, string>();
  for (const r of rows ?? []) {
    const row = r as { label_normalized: string; label_core: string; inventory_item_id: string };
    map.set(row.label_normalized, row.inventory_item_id);
    map.set(row.label_core, row.inventory_item_id);
  }
  return map;
}

/**
 * Conversions BL → stock mémorisées (même clés que les alias : normalisé + label_core).
 */
export async function fetchDeliveryLabelConversionHintsMap(
  restaurantId: string,
  supplierId: string
): Promise<Map<string, SavedBlConversionHint>> {
  const { data: rows, error } = await supabaseServer
    .from("inventory_delivery_label_aliases")
    .select("label_normalized, label_core, bl_purchase_unit, stock_units_per_purchase")
    .eq("restaurant_id", restaurantId)
    .eq("supplier_id", supplierId);

  if (error) {
    console.warn("[inventory_delivery_label_aliases conversion]", error.message);
    return new Map();
  }

  const map = new Map<string, SavedBlConversionHint>();
  for (const r of rows ?? []) {
    const row = r as {
      label_normalized: string;
      label_core: string;
      bl_purchase_unit: string | null;
      stock_units_per_purchase: number | null;
    };
    const sup = Number(row.stock_units_per_purchase);
    if (!Number.isFinite(sup) || sup <= 0) continue;
    const hint: SavedBlConversionHint = {
      stockUnitsPerPurchase: sup,
      blPurchaseUnit: row.bl_purchase_unit,
    };
    map.set(row.label_normalized, hint);
    map.set(row.label_core, hint);
  }
  return map;
}

export async function upsertDeliveryLabelAlias(
  restaurantId: string,
  supplierId: string,
  rawLabel: string,
  inventoryItemId: string,
  conversion?: { purchaseUnit: string | null; stockUnitsPerPurchase: number }
): Promise<{ error: string | null }> {
  const label_normalized = normalizeInventoryItemName(rawLabel);
  const label_core = computeDeliveryLabelCore(rawLabel);

  let bl_purchase_unit: string | null;
  let stock_units_per_purchase: number | null;

  if (conversion !== undefined) {
    bl_purchase_unit = conversion.purchaseUnit;
    stock_units_per_purchase = conversion.stockUnitsPerPurchase;
  } else {
    const { data: existing } = await supabaseServer
      .from("inventory_delivery_label_aliases")
      .select("bl_purchase_unit, stock_units_per_purchase")
      .eq("restaurant_id", restaurantId)
      .eq("supplier_id", supplierId)
      .eq("label_core", label_core)
      .maybeSingle();

    const ex = existing as {
      bl_purchase_unit: string | null;
      stock_units_per_purchase: number | null;
    } | null;
    bl_purchase_unit = ex?.bl_purchase_unit ?? null;
    stock_units_per_purchase =
      ex?.stock_units_per_purchase != null ? Number(ex.stock_units_per_purchase) : null;
  }

  const { error } = await supabaseServer.from("inventory_delivery_label_aliases").upsert(
    {
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      label_normalized,
      label_core,
      inventory_item_id: inventoryItemId,
      bl_purchase_unit,
      stock_units_per_purchase,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id,supplier_id,label_core" }
  );
  if (error) return { error: error.message };
  return { error: null };
}
