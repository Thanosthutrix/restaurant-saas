import { supabaseServer } from "@/lib/supabaseServer";
import { toNumber } from "@/lib/utils/safeNumeric";

export type ExplodedItem = {
  inventoryItemId: string;
  name: string;
  unit: string;
  itemType: string;
  qty: number;
};

export type ExplodeOptions = {
  /**
   * Profondeur de dépliage des préparations (prep).
   * - 1 : pas de dépliage — seuls les composants directs du plat sont retournés (les preps restent en bloc).
   * - 2 : un niveau de prep — les preps directes sont dépliées une fois en leurs composants.
   * - n : (n-1) niveaux de preps dépliés.
   * Défaut : 10 (dépliage complet dans la limite des niveaux).
   */
  maxDepth?: number;
};

type ItemRow = { id: string; name: string; unit: string; item_type: string };

/**
 * Déplie à partir de lignes « racine » (plat ou préparation) jusqu’aux feuilles ingredient / resale.
 */
async function explodeFromSeeds(
  restaurantId: string,
  seeds: { itemId: string; qty: number }[],
  maxDepth: number
): Promise<ExplodedItem[]> {
  const { data: itemsData, error: itemsErr } = await supabaseServer
    .from("inventory_items")
    .select("id, name, unit, item_type")
    .eq("restaurant_id", restaurantId);

  if (itemsErr) {
    throw new Error(itemsErr.message);
  }

  const itemMap = new Map((itemsData ?? []).map((i) => [(i as ItemRow).id, i as ItemRow]));

  const aggregated = new Map<string, number>();
  const path = new Set<string>();

  async function addComponent(itemId: string, qty: number, depth: number): Promise<void> {
    if (path.has(itemId)) {
      throw new Error(
        `Boucle de composition détectée dans les données (inventory_item ${itemId} apparaît deux fois dans un même chemin). Vérifiez les compositions des préparations.`
      );
    }
    const item = itemMap.get(itemId);
    if (!item) return;
    const stopRecurse = depth >= maxDepth;

    if (item.item_type === "prep" && !stopRecurse) {
      path.add(itemId);
      try {
        const { data: comps } = await supabaseServer
          .from("inventory_item_components")
          .select("component_item_id, qty")
          .eq("restaurant_id", restaurantId)
          .eq("parent_item_id", itemId);
        const rows = (comps ?? []) as { component_item_id: string; qty: unknown }[];
        for (const r of rows) {
          const componentQty = toNumber(r.qty) * qty;
          if (componentQty <= 0) continue;
          await addComponent(r.component_item_id, componentQty, depth + 1);
        }
      } finally {
        path.delete(itemId);
      }
    } else {
      aggregated.set(itemId, (aggregated.get(itemId) ?? 0) + qty);
    }
  }

  for (const s of seeds) {
    if (s.qty <= 0) continue;
    await addComponent(s.itemId, s.qty, 1);
  }

  return Array.from(aggregated.entries()).map(([inventoryItemId, qty]) => {
    const item = itemMap.get(inventoryItemId)!;
    return {
      inventoryItemId,
      name: item.name,
      unit: item.unit,
      itemType: item.item_type,
      qty,
    };
  });
}

/**
 * Déplie la recette d'un plat jusqu'aux composants de base (ingredient / resale).
 * Les préparations (prep) sont dépliées récursivement selon maxDepth.
 * Protège contre un cycle déjà présent en base (lève une erreur si boucle détectée).
 */
export async function explodeDishComponents(
  restaurantId: string,
  dishId: string,
  options?: ExplodeOptions
): Promise<ExplodedItem[]> {
  const maxDepth = options?.maxDepth ?? 10;

  const { data: dcData, error: dcErr } = await supabaseServer
    .from("dish_components")
    .select("inventory_item_id, qty")
    .eq("restaurant_id", restaurantId)
    .eq("dish_id", dishId);

  if (dcErr) {
    throw new Error(dcErr.message);
  }

  const direct = (dcData ?? []) as { inventory_item_id: string; qty: unknown }[];
  const seeds = direct
    .map((row) => ({ itemId: row.inventory_item_id, qty: toNumber(row.qty) }))
    .filter((s) => s.qty > 0);

  return explodeFromSeeds(restaurantId, seeds, maxDepth);
}

/**
 * Déplie la recette d'une préparation (1 unité de stock de ce parent) jusqu’aux feuilles.
 * Même logique que pour un plat : qty des lignes = quantités pour 1 unité du parent (ex. 1 sceau).
 */
export async function explodePrepComponents(
  restaurantId: string,
  prepInventoryItemId: string,
  options?: ExplodeOptions
): Promise<ExplodedItem[]> {
  const maxDepth = options?.maxDepth ?? 10;

  const { data: iicData, error: iicErr } = await supabaseServer
    .from("inventory_item_components")
    .select("component_item_id, qty")
    .eq("restaurant_id", restaurantId)
    .eq("parent_item_id", prepInventoryItemId);

  if (iicErr) {
    throw new Error(iicErr.message);
  }

  const rows = (iicData ?? []) as { component_item_id: string; qty: unknown }[];
  const seeds = rows
    .map((r) => ({ itemId: r.component_item_id, qty: toNumber(r.qty) }))
    .filter((s) => s.qty > 0);

  return explodeFromSeeds(restaurantId, seeds, maxDepth);
}

/**
 * Retourne uniquement le premier niveau : les composants directs du plat (sans déplier les preps).
 * Équivalent à explodeDishComponents avec maxDepth: 1.
 */
export async function getDishComponentsOneLevel(
  restaurantId: string,
  dishId: string
): Promise<{ inventoryItemId: string; name: string; unit: string; itemType: string; qty: number }[]> {
  const [dcRes, itemsRes] = await Promise.all([
    supabaseServer
      .from("dish_components")
      .select("inventory_item_id, qty")
      .eq("restaurant_id", restaurantId)
      .eq("dish_id", dishId),
    supabaseServer
      .from("inventory_items")
      .select("id, name, unit, item_type")
      .eq("restaurant_id", restaurantId),
  ]);

  const itemMap = new Map(
    ((itemsRes.data ?? []) as { id: string; name: string; unit: string; item_type: string }[]).map((i) => [
      i.id,
      i,
    ])
  );
  const rows = (dcRes.data ?? []) as { inventory_item_id: string; qty: unknown }[];

  return rows.map((r) => {
    const item = itemMap.get(r.inventory_item_id);
    return {
      inventoryItemId: r.inventory_item_id,
      name: item?.name ?? "",
      unit: item?.unit ?? "",
      itemType: item?.item_type ?? "",
      qty: toNumber(r.qty),
    };
  });
}
