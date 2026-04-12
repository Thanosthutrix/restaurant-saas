import { supabaseServer } from "@/lib/supabaseServer";
import { computeDeliveryLabelCore } from "@/lib/matching/deliveryLabelCore";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";

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

export async function upsertDeliveryLabelAlias(
  restaurantId: string,
  supplierId: string,
  rawLabel: string,
  inventoryItemId: string
): Promise<{ error: string | null }> {
  const label_normalized = normalizeInventoryItemName(rawLabel);
  const label_core = computeDeliveryLabelCore(rawLabel);
  const { error } = await supabaseServer.from("inventory_delivery_label_aliases").upsert(
    {
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      label_normalized,
      label_core,
      inventory_item_id: inventoryItemId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id,supplier_id,label_core" }
  );
  if (error) return { error: error.message };
  return { error: null };
}
