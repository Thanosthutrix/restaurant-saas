/**
 * Calcul de la consommation théorique à partir des ventes.
 *
 * Principe :
 * - On part d'une liste de ventes (dish_id + qty vendue).
 * - Pour chaque plat, on explose la recette (dish_components puis inventory_item_components pour les preps).
 * - On multiplie les quantités par le nombre vendu.
 * - On consolide par inventory_item_id (ingredient, prep ou resale en "feuille").
 *
 * Cas gérés explicitement :
 * - Recette manquante (plat sans composants) → warning, pas de consommation pour ce plat.
 * - Recette en brouillon (recipe_status = draft) → pas de consommation pour ce plat (sécurité stock).
 * - Seules les recettes validées (recipe_status = validated) sont utilisées pour la décrémentation théorique.
 * - Préparation sans composants → warning, on consomme la préparation comme bloc (en qty).
 * - Boucle dans les preps → warning, on traite la prep en feuille pour ne pas boucler.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { toNumber } from "@/lib/utils/safeNumeric";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

/** Une vente : plat vendu et quantité. */
export type SaleInput = {
  dish_id: string;
  qty: number;
};

/** Un item consommé (ingredient, prep ou resale) avec quantité totale. */
export type ConsumedItem = {
  inventory_item_id: string;
  name: string;
  unit: string;
  item_type: "ingredient" | "prep" | "resale";
  qty: number;
};

/** Type de warning pour tracer les cas limites. */
export type ConsumptionWarningType =
  | "missing_recipe"
  | "draft_recipe"
  | "prep_without_components"
  | "cycle";

export type ConsumptionWarning = {
  type: ConsumptionWarningType;
  /** Plat concerné (pour missing_recipe / draft_recipe). */
  dish_id?: string;
  /** Item concerné (prep sans composants ou entrant dans un cycle). */
  item_id?: string;
  message: string;
};

export type ComputeSalesConsumptionResult = {
  consumption: ConsumedItem[];
  warnings: ConsumptionWarning[];
};

// ---------------------------------------------------------------------------
// DONNÉES INTERNES (chargées une fois)
// ---------------------------------------------------------------------------

type InventoryItemRow = {
  id: string;
  name: string;
  unit: string;
  item_type: string;
};

type DishComponentRow = {
  dish_id: string;
  inventory_item_id: string;
  qty: unknown;
};

type PrepComponentRow = {
  parent_item_id: string;
  component_item_id: string;
  qty: unknown;
};

// ---------------------------------------------------------------------------
// FONCTION PRINCIPALE
// ---------------------------------------------------------------------------

/**
 * Calcule la consommation théorique à partir d'une liste de ventes.
 *
 * @param restaurantId - Restaurant concerné
 * @param sales - Liste des ventes (dish_id, qty). Les qty doivent être > 0.
 * @returns Consommation consolidée par inventory_item + liste de warnings (recette manquante, prep sans composants, cycle)
 */
export async function computeSalesConsumption(
  restaurantId: string,
  sales: SaleInput[]
): Promise<ComputeSalesConsumptionResult> {
  const warnings: ConsumptionWarning[] = [];
  const aggregated = new Map<string, number>();

  // Filtrer les ventes avec quantité valide
  const validSales = sales.filter((s) => Number.isFinite(s.qty) && s.qty > 0);
  if (validSales.length === 0) {
    return { consumption: [], warnings: [] };
  }

  const dishIds = [...new Set(validSales.map((s) => s.dish_id))];

  // 1) Charger plats (recipe_status), composants plats, inventory_items, composants preps
  const [dishesRes, dishComponentsRes, inventoryItemsRes, prepComponentsRes] = await Promise.all([
    supabaseServer
      .from("dishes")
      .select("id, recipe_status")
      .eq("restaurant_id", restaurantId)
      .in("id", dishIds),
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

  const dishes = (dishesRes.data ?? []) as { id: string; recipe_status: string | null }[];
  const dishRecipeStatusById = new Map(dishes.map((d) => [d.id, d.recipe_status ?? "missing"]));

  const dishComponents = (dishComponentsRes.data ?? []) as DishComponentRow[];
  const inventoryItems = (inventoryItemsRes.data ?? []) as InventoryItemRow[];
  const prepComponents = (prepComponentsRes.data ?? []) as PrepComponentRow[];

  const itemMap = new Map<string, InventoryItemRow>(
    inventoryItems.map((i) => [i.id, i])
  );

  // Composants directs par plat (dish_id -> [{ inventory_item_id, qty }])
  const dishComponentsByDish = new Map<string, { inventory_item_id: string; qty: number }[]>();
  for (const row of dishComponents) {
    const qty = toNumber(row.qty);
    if (qty <= 0) continue;
    const list = dishComponentsByDish.get(row.dish_id) ?? [];
    list.push({ inventory_item_id: row.inventory_item_id, qty });
    dishComponentsByDish.set(row.dish_id, list);
  }

  // Composants des preps (parent_item_id -> [{ component_item_id, qty }])
  const prepComponentsByParent = new Map<string, { component_item_id: string; qty: number }[]>();
  for (const row of prepComponents) {
    const qty = toNumber(row.qty);
    if (qty <= 0) continue;
    const list = prepComponentsByParent.get(row.parent_item_id) ?? [];
    list.push({ component_item_id: row.component_item_id, qty });
    prepComponentsByParent.set(row.parent_item_id, list);
  }

  /**
   * Ajoute à la consommation : soit on explose une prep (récursif), soit on ajoute l'item en feuille.
   * path sert à détecter une boucle (même item deux fois dans le même chemin).
   */
  function addComponent(
    itemId: string,
    qty: number,
    path: Set<string>
  ): void {
    const item = itemMap.get(itemId);
    if (!item) return;

    // Boucle détectée : on traite l'item en feuille pour ne pas boucler à l'infini
    if (path.has(itemId)) {
      warnings.push({
        type: "cycle",
        item_id: itemId,
        message: `Boucle de composition détectée (préparation "${item.name}"). Consommation comptée comme bloc.`,
      });
      aggregated.set(itemId, (aggregated.get(itemId) ?? 0) + qty);
      return;
    }

    // Ingredient ou resale : feuille, on ajoute directement
    if (item.item_type === "ingredient" || item.item_type === "resale") {
      aggregated.set(itemId, (aggregated.get(itemId) ?? 0) + qty);
      return;
    }

    // Prep : on tente d'exploser ; si pas de composants, on consomme la prep comme bloc
    if (item.item_type === "prep") {
      const comps = prepComponentsByParent.get(itemId);
      if (!comps || comps.length === 0) {
        warnings.push({
          type: "prep_without_components",
          item_id: itemId,
          message: `Préparation "${item.name}" sans composition. Consommation comptée comme bloc.`,
        });
        aggregated.set(itemId, (aggregated.get(itemId) ?? 0) + qty);
        return;
      }
      path.add(itemId);
      try {
        for (const c of comps) {
          const childQty = c.qty * qty;
          if (childQty <= 0) continue;
          addComponent(c.component_item_id, childQty, path);
        }
      } finally {
        path.delete(itemId);
      }
    } else {
      // Type inconnu : on compte comme feuille
      aggregated.set(itemId, (aggregated.get(itemId) ?? 0) + qty);
    }
  }

  // 2) Pour chaque vente, n'exploser que les plats à recette validée
  for (const sale of validSales) {
    const recipeStatus = dishRecipeStatusById.get(sale.dish_id) ?? "missing";
    if (recipeStatus !== "validated") {
      console.log(`[computeSalesConsumption] Plat dish_id=${sale.dish_id} ignoré : recette non validée (status=${recipeStatus}). Aucune décrémentation pour ce plat.`);
      warnings.push({
        type: recipeStatus === "draft" ? "draft_recipe" : "missing_recipe",
        dish_id: sale.dish_id,
        message:
          recipeStatus === "draft"
            ? `Plat (dish_id: ${sale.dish_id}) en brouillon : recette non utilisée pour le stock. Finalisez et validez la recette pour inclure la consommation.`
            : `Plat (dish_id: ${sale.dish_id}) sans recette. Aucune consommation calculée pour ce plat.`,
      });
      continue;
    }
    const direct = dishComponentsByDish.get(sale.dish_id);
    if (!direct || direct.length === 0) {
      console.log(`[computeSalesConsumption] Plat dish_id=${sale.dish_id} ignoré : aucun composant dans dish_components.`);
      warnings.push({
        type: "missing_recipe",
        dish_id: sale.dish_id,
        message: `Plat (dish_id: ${sale.dish_id}) sans composants. Aucune consommation calculée.`,
      });
      continue;
    }
    console.log(`[computeSalesConsumption] Plat dish_id=${sale.dish_id} traité : qty vendue=${sale.qty}, ${direct.length} composant(s) direct(s).`);
    const path = new Set<string>();
    for (const dc of direct) {
      const qty = dc.qty * sale.qty;
      if (qty <= 0) continue;
      addComponent(dc.inventory_item_id, qty, path);
    }
  }

  // 3) Construire le tableau de consommation avec noms et unités
  const consumption: ConsumedItem[] = [];
  for (const [inventoryItemId, qty] of aggregated.entries()) {
    const item = itemMap.get(inventoryItemId);
    if (!item || qty <= 0) continue;
    const itemType = item.item_type as "ingredient" | "prep" | "resale";
    consumption.push({
      inventory_item_id: inventoryItemId,
      name: item.name,
      unit: item.unit,
      item_type: itemType,
      qty,
    });
  }

  // Tri par nom pour affichage stable
  consumption.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  console.log(`[computeSalesConsumption] Résultat : ${consumption.length} composant(s) à décrémenter, ${warnings.length} avertissement(s). Plats ignorés (draft/missing) = pas de mise à jour stock.`);
  if (consumption.length === 0 && validSales.length > 0) {
    console.log("[computeSalesConsumption] Aucune consommation : vérifiez que les plats vendus ont recipe_status = 'validated' et des lignes dans dish_components.");
  }

  return { consumption, warnings };
}
