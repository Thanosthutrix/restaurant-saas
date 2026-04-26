/**
 * Coût matière théorique (recette dépliée × coûts unitaires) et lignes pour l’écran marges.
 * Coût unitaire par composant : dernier achat connu, sinon prix de référence fiche inventaire.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { explodeDishComponents, explodePrepComponents, type ExplodedItem } from "@/lib/recipes/explodeDishComponents";
import { getLastKnownPurchaseUnitCostByItemIds, roundMoney } from "@/lib/stock/purchasePriceHistory";
import { normalizeVatRatePct, sellingPriceHtFromTtc } from "@/lib/tax/frenchSellingVat";
import { toNumber } from "@/lib/utils/safeNumeric";

async function getUnitCostsForMargin(restaurantId: string, itemIds: string[]): Promise<Map<string, number>> {
  const costMap = await getLastKnownPurchaseUnitCostByItemIds(restaurantId, itemIds);
  const missing = itemIds.filter((id) => !costMap.has(id));
  if (missing.length === 0) return costMap;

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .select("id, reference_purchase_unit_cost_ht")
    .eq("restaurant_id", restaurantId)
    .in("id", missing);

  if (error || !data) return costMap;

  for (const row of data) {
    const id = (row as { id: string }).id;
    const raw = (row as { reference_purchase_unit_cost_ht: unknown }).reference_purchase_unit_cost_ht;
    const n = raw == null ? NaN : Number(raw);
    if (Number.isFinite(n) && n > 0) costMap.set(id, roundMoney(n));
  }
  return costMap;
}

export type DishFoodCostBreakdownLine = {
  inventoryItemId: string;
  name: string;
  unit: string;
  qty: number;
  unitCostHt: number | null;
  lineCostHt: number | null;
};

export type DishFoodCostResult = {
  foodCostHt: number;
  costIsComplete: boolean;
  breakdown: DishFoodCostBreakdownLine[];
  errorMessage: string | null;
};

async function computeFoodCostFromExploded(
  restaurantId: string,
  exploded: ExplodedItem[]
): Promise<DishFoodCostResult> {
  if (exploded.length === 0) {
    return { foodCostHt: 0, costIsComplete: true, breakdown: [], errorMessage: null };
  }

  const ids = [...new Set(exploded.map((e) => e.inventoryItemId))];
  const costs = await getUnitCostsForMargin(restaurantId, ids);
  let sum = 0;
  let complete = true;
  const breakdown: DishFoodCostBreakdownLine[] = [];

  for (const e of exploded) {
    const uc = costs.get(e.inventoryItemId) ?? null;
    const lineCost = uc != null ? roundMoney(e.qty * uc) : null;
    if (uc == null) complete = false;
    else sum += lineCost!;
    breakdown.push({
      inventoryItemId: e.inventoryItemId,
      name: e.name,
      unit: e.unit,
      qty: e.qty,
      unitCostHt: uc,
      lineCostHt: lineCost,
    });
  }

  return {
    foodCostHt: roundMoney(sum),
    costIsComplete: complete,
    breakdown,
    errorMessage: null,
  };
}

type MarginItemRow = {
  id: string;
  name: string;
  unit: string;
  item_type: string;
};

type MarginRecipeGraph = {
  itemById: Map<string, MarginItemRow>;
  prepComponentsByParentId: Map<string, { component_item_id: string; qty: number }[]>;
};

function explodeSeedsFromGraph(
  graph: MarginRecipeGraph,
  seeds: { itemId: string; qty: number }[],
  maxDepth = 10
): ExplodedItem[] {
  const aggregated = new Map<string, number>();
  const path = new Set<string>();

  function addComponent(itemId: string, qty: number, depth: number) {
    if (path.has(itemId)) {
      throw new Error(
        `Boucle de composition détectée dans les données (inventory_item ${itemId} apparaît deux fois dans un même chemin). Vérifiez les compositions des préparations.`
      );
    }
    const item = graph.itemById.get(itemId);
    if (!item) return;

    if (item.item_type === "prep" && depth < maxDepth) {
      path.add(itemId);
      try {
        for (const row of graph.prepComponentsByParentId.get(itemId) ?? []) {
          const componentQty = row.qty * qty;
          if (componentQty > 0) addComponent(row.component_item_id, componentQty, depth + 1);
        }
      } finally {
        path.delete(itemId);
      }
      return;
    }

    aggregated.set(itemId, (aggregated.get(itemId) ?? 0) + qty);
  }

  for (const seed of seeds) {
    if (seed.qty > 0) addComponent(seed.itemId, seed.qty, 1);
  }

  return Array.from(aggregated.entries()).map(([inventoryItemId, qty]) => {
    const item = graph.itemById.get(inventoryItemId)!;
    return {
      inventoryItemId,
      name: item.name,
      unit: item.unit,
      itemType: item.item_type,
      qty,
    };
  });
}

function computeFoodCostFromExplodedWithCosts(
  exploded: ExplodedItem[],
  costs: Map<string, number>
): DishFoodCostResult {
  if (exploded.length === 0) {
    return { foodCostHt: 0, costIsComplete: true, breakdown: [], errorMessage: null };
  }

  let sum = 0;
  let complete = true;
  const breakdown: DishFoodCostBreakdownLine[] = [];
  for (const e of exploded) {
    const uc = costs.get(e.inventoryItemId) ?? null;
    const lineCost = uc != null ? roundMoney(e.qty * uc) : null;
    if (uc == null) complete = false;
    else sum += lineCost!;
    breakdown.push({
      inventoryItemId: e.inventoryItemId,
      name: e.name,
      unit: e.unit,
      qty: e.qty,
      unitCostHt: uc,
      lineCostHt: lineCost,
    });
  }

  return {
    foodCostHt: roundMoney(sum),
    costIsComplete: complete,
    breakdown,
    errorMessage: null,
  };
}

export async function computeDishFoodCostHt(
  restaurantId: string,
  dishId: string
): Promise<DishFoodCostResult> {
  let exploded: ExplodedItem[];
  try {
    exploded = await explodeDishComponents(restaurantId, dishId, { maxDepth: 10 });
  } catch (e) {
    return {
      foodCostHt: 0,
      costIsComplete: false,
      breakdown: [],
      errorMessage: e instanceof Error ? e.message : "Erreur lors du dépliage de la recette.",
    };
  }
  return computeFoodCostFromExploded(restaurantId, exploded);
}

/** Coût matière pour 1 unité de stock de la préparation (ex. 1 sceau), recette dépliée. */
export async function computePrepFoodCostHt(
  restaurantId: string,
  prepInventoryItemId: string
): Promise<DishFoodCostResult> {
  let exploded: ExplodedItem[];
  try {
    exploded = await explodePrepComponents(restaurantId, prepInventoryItemId, { maxDepth: 10 });
  } catch (e) {
    return {
      foodCostHt: 0,
      costIsComplete: false,
      breakdown: [],
      errorMessage: e instanceof Error ? e.message : "Erreur lors du dépliage de la préparation.",
    };
  }
  return computeFoodCostFromExploded(restaurantId, exploded);
}

export type MarginAnalysisRow = {
  dishId: string;
  dishName: string;
  recipeStatus: string | null;
  componentCount: number;
  sellingPriceTtc: number | null;
  sellingVatRatePct: number | null;
  sellingPriceHt: number | null;
  foodCostHt: number | null;
  costIsComplete: boolean;
  marginHt: number | null;
  marginPct: number | null;
  note: string | null;
};

function parsePositivePrice(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return roundMoney(n);
}

function roundPct(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function getMarginAnalysisRows(
  restaurantId: string
): Promise<{ rows: MarginAnalysisRow[]; error: Error | null }> {
  const { data: dishes, error: dErr } = await supabaseServer
    .from("dishes")
    .select("id, name, recipe_status, selling_price_ht, selling_price_ttc, selling_vat_rate_pct")
    .eq("restaurant_id", restaurantId)
    .order("name");

  if (dErr) return { rows: [], error: new Error(dErr.message) };
  if (!dishes?.length) return { rows: [], error: null };

  const dishIds = dishes.map((d) => (d as { id: string }).id);
  const [dcRes, itemsRes, prepComponentsRes] = await Promise.all([
    supabaseServer
      .from("dish_components")
      .select("dish_id, inventory_item_id, qty")
      .eq("restaurant_id", restaurantId)
      .in("dish_id", dishIds),
    supabaseServer
      .from("inventory_items")
      .select("id, name, unit, item_type")
      .eq("restaurant_id", restaurantId),
    supabaseServer
      .from("inventory_item_components")
      .select("parent_item_id, component_item_id, qty")
      .eq("restaurant_id", restaurantId),
  ]);

  const dcRows = dcRes.data ?? [];

  const countByDish = new Map<string, number>();
  const seedsByDish = new Map<string, { itemId: string; qty: number }[]>();
  for (const r of dcRows) {
    const id = (r as { dish_id: string }).dish_id;
    countByDish.set(id, (countByDish.get(id) ?? 0) + 1);
    const row = r as { dish_id: string; inventory_item_id: string; qty: unknown };
    const qty = toNumber(row.qty);
    if (qty > 0) {
      const seeds = seedsByDish.get(row.dish_id) ?? [];
      seeds.push({ itemId: row.inventory_item_id, qty });
      seedsByDish.set(row.dish_id, seeds);
    }
  }

  const graph: MarginRecipeGraph = {
    itemById: new Map(((itemsRes.data ?? []) as MarginItemRow[]).map((i) => [i.id, i])),
    prepComponentsByParentId: new Map(),
  };
  for (const raw of prepComponentsRes.data ?? []) {
    const row = raw as { parent_item_id: string; component_item_id: string; qty: unknown };
    const qty = toNumber(row.qty);
    if (qty <= 0) continue;
    const list = graph.prepComponentsByParentId.get(row.parent_item_id) ?? [];
    list.push({ component_item_id: row.component_item_id, qty });
    graph.prepComponentsByParentId.set(row.parent_item_id, list);
  }

  const explodedByDish = new Map<string, ExplodedItem[]>();
  const allExplodedItemIds = new Set<string>();
  for (const [dishId, seeds] of seedsByDish) {
    try {
      const exploded = explodeSeedsFromGraph(graph, seeds, 10);
      explodedByDish.set(dishId, exploded);
      for (const e of exploded) allExplodedItemIds.add(e.inventoryItemId);
    } catch {
      // L'erreur de boucle sera restituée au moment du traitement de la ligne.
    }
  }

  const costMap = await getUnitCostsForMargin(restaurantId, [...allExplodedItemIds]);

  const rows: MarginAnalysisRow[] = [];

  for (const d of dishes) {
    const id = (d as { id: string }).id;
    const name = String((d as { name: string }).name);
    const recipeStatus = (d as { recipe_status: string | null }).recipe_status ?? null;
    const row = d as {
      selling_price_ht: unknown;
      selling_price_ttc: unknown;
      selling_vat_rate_pct: unknown;
    };
    const ttc = parsePositivePrice(row.selling_price_ttc);
    const vat = normalizeVatRatePct(row.selling_vat_rate_pct, 10);
    let sp = parsePositivePrice(row.selling_price_ht);
    if (sp == null && ttc != null) {
      sp = sellingPriceHtFromTtc(ttc, vat);
    }
    const nComp = countByDish.get(id) ?? 0;

    if (nComp === 0) {
      rows.push({
        dishId: id,
        dishName: name,
        recipeStatus,
        componentCount: 0,
        sellingPriceTtc: ttc,
        sellingVatRatePct: vat,
        sellingPriceHt: sp,
        foodCostHt: null,
        costIsComplete: true,
        marginHt: null,
        marginPct: null,
        note: "Aucun composant dans la recette",
      });
      continue;
    }

    let costRes: DishFoodCostResult;
    try {
      const exploded = explodedByDish.get(id) ?? explodeSeedsFromGraph(graph, seedsByDish.get(id) ?? [], 10);
      costRes = computeFoodCostFromExplodedWithCosts(exploded, costMap);
    } catch (e) {
      costRes = {
        foodCostHt: 0,
        costIsComplete: false,
        breakdown: [],
        errorMessage: e instanceof Error ? e.message : "Erreur lors du dépliage de la recette.",
      };
    }
    if (costRes.errorMessage) {
      rows.push({
        dishId: id,
        dishName: name,
        recipeStatus,
        componentCount: nComp,
        sellingPriceTtc: ttc,
        sellingVatRatePct: vat,
        sellingPriceHt: sp,
        foodCostHt: null,
        costIsComplete: false,
        marginHt: null,
        marginPct: null,
        note: costRes.errorMessage,
      });
      continue;
    }

    const fc = costRes.costIsComplete ? costRes.foodCostHt : null;
    let marginHt: number | null = null;
    let marginPct: number | null = null;
    let note: string | null = null;

    if (!costRes.costIsComplete) {
      note = "Coût incomplet : renseignez un prix d’achat (réception, historique ou référence fiche composant).";
    }

    if (sp != null && costRes.costIsComplete) {
      marginHt = roundMoney(sp - costRes.foodCostHt);
      marginPct = sp > 0 ? roundPct(((sp - costRes.foodCostHt) / sp) * 100) : null;
    }

    rows.push({
      dishId: id,
      dishName: name,
      recipeStatus,
      componentCount: nComp,
      sellingPriceTtc: ttc,
      sellingVatRatePct: vat,
      sellingPriceHt: sp,
      foodCostHt: fc,
      costIsComplete: costRes.costIsComplete,
      marginHt,
      marginPct,
      note,
    });
  }

  return { rows, error: null };
}
