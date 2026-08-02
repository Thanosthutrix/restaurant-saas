/**
 * Création du restaurant et de sa carte : rubriques, fournisseurs, articles de
 * stock, préparations maison et plats avec leurs recettes.
 *
 * Tout passe par les fonctions de l'application (`createDish`, qui adosse
 * lui-même un article de stock aux plats de revente) pour que le résultat soit
 * identique à ce qu'obtiendrait un restaurateur saisissant sa carte à la main.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createDish } from "@/lib/db";
import { roundRecipeQty } from "@/lib/units/stockUnitConversion";
import {
  DISHES, INGREDIENTS, PREPARATIONS, SUPPLIERS,
  type DishDef, type SupplierKey,
} from "./catalog";
import { OPEN_DAYS } from "./team";

export const DEMO_NAME = "Le Comptoir du Marché";

export type CatalogIds = {
  restaurantId: string;
  /** nom → id, pour inventory_items (ingrédients, préparations, revente). */
  itemIds: Map<string, string>;
  /** nom du plat → id. */
  dishIds: Map<string, string>;
  /** clé fournisseur → id. */
  supplierIds: Map<SupplierKey, string>;
  /** chemin de rubrique → id. */
  categoryIds: Map<string, string>;
};

/** Horaires d'ouverture : services midi et soir, du mardi au samedi. */
export const OPENING_HOURS = {
  mon: [],
  tue: [{ start: "12:00", end: "14:30" }, { start: "19:00", end: "22:30" }],
  wed: [{ start: "12:00", end: "14:30" }, { start: "19:00", end: "22:30" }],
  thu: [{ start: "12:00", end: "14:30" }, { start: "19:00", end: "22:30" }],
  fri: [{ start: "12:00", end: "14:30" }, { start: "19:00", end: "23:00" }],
  sat: [{ start: "12:00", end: "15:00" }, { start: "19:00", end: "23:00" }],
  sun: [],
};

// ---------------------------------------------------------------------------
// RESTAURANT
// ---------------------------------------------------------------------------

export async function createRestaurant(sb: SupabaseClient, ownerId: string): Promise<string> {
  const { data, error } = await sb
    .from("restaurants")
    .insert({
      name: DEMO_NAME,
      owner_id: ownerId,
      activity_type: "brasserie-traditionnel",
      template_slug: "brasserie-traditionnel",
      service_type: "both",
      avg_covers: 78,
      address_text: "14 rue du Marché Saint-Honoré, 75001 Paris",
      latitude: 48.8657,
      longitude: 2.3318,
      planning_opening_hours: OPENING_HOURS,
      planning_staff_targets_weekly: {},
    })
    .select("id")
    .single();

  if (error) throw new Error(`Création du restaurant : ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * Supprime les restaurants de démo précédents du propriétaire.
 * Les tables filles disparaissent en cascade (contrainte ON DELETE CASCADE).
 */
export async function wipePreviousDemo(sb: SupabaseClient, ownerId: string): Promise<string[]> {
  const { data, error } = await sb
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", ownerId);
  if (error) throw new Error(`Lecture des restaurants : ${error.message}`);

  const rows = (data ?? []) as { id: string; name: string }[];
  const removed: string[] = [];
  for (const r of rows) {
    const { error: delErr } = await sb.from("restaurants").delete().eq("id", r.id);
    if (delErr) throw new Error(`Suppression de « ${r.name} » : ${delErr.message}`);
    removed.push(`${r.name} (${r.id})`);
  }
  return removed;
}

// ---------------------------------------------------------------------------
// RUBRIQUES
// ---------------------------------------------------------------------------

/** Crée l'arborescence des rubriques à partir des chemins « Carte/Plats/Viandes ». */
export async function seedCategories(
  sb: SupabaseClient,
  restaurantId: string
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  const dishPaths = new Set(DISHES.map((d) => d.categoryPath));
  const stockPaths = new Set([
    ...INGREDIENTS.map((i) => `Stock/${i.category}`),
    ...PREPARATIONS.map((p) => `Stock/Préparations/${p.category}`),
  ]);

  // Les parents doivent exister avant leurs enfants : on trie par profondeur.
  const allPaths = [...dishPaths, ...stockPaths];
  const expanded = new Set<string>();
  for (const path of allPaths) {
    const parts = path.split("/");
    for (let i = 1; i <= parts.length; i++) expanded.add(parts.slice(0, i).join("/"));
  }
  const ordered = [...expanded].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));

  let sortOrder = 0;
  for (const path of ordered) {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const parentId = parentPath ? ids.get(parentPath) ?? null : null;
    const appliesTo = path.startsWith("Stock") ? "inventory" : "dish";

    const { data, error } = await sb
      .from("restaurant_categories")
      .insert({
        restaurant_id: restaurantId,
        parent_id: parentId,
        name,
        sort_order: sortOrder++,
        applies_to: appliesTo,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Rubrique « ${path} » : ${error.message}`);
    ids.set(path, (data as { id: string }).id);
  }

  return ids;
}

// ---------------------------------------------------------------------------
// FOURNISSEURS
// ---------------------------------------------------------------------------

export async function seedSuppliers(
  sb: SupabaseClient,
  restaurantId: string
): Promise<Map<SupplierKey, string>> {
  const ids = new Map<SupplierKey, string>();
  for (const [key, s] of Object.entries(SUPPLIERS) as [SupplierKey, typeof SUPPLIERS[SupplierKey]][]) {
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const { data, error } = await sb
      .from("suppliers")
      .insert({
        restaurant_id: restaurantId,
        name: s.name,
        email: s.email,
        phone: s.phone,
        // On commande la veille pour une livraison le lendemain matin.
        order_days: s.deliveryDays.map((d) => dayNames[(d - s.leadDays + 7) % 7]),
        lead_time_days: s.leadDays,
        cut_off_time: "17:00",
        preferred_order_method: "EMAIL",
        notes: `Interlocuteur : ${s.contact_name}.`,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Fournisseur « ${s.name} » : ${error.message}`);
    ids.set(key, (data as { id: string }).id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// STOCK : INGRÉDIENTS ET PRÉPARATIONS
// ---------------------------------------------------------------------------

export async function seedInventory(
  sb: SupabaseClient,
  restaurantId: string,
  categoryIds: Map<string, string>,
  supplierIds: Map<SupplierKey, string>
): Promise<Map<string, string>> {
  const itemIds = new Map<string, string>();

  // 1) Matières premières : prix d'achat de référence et conditionnement fournisseur.
  for (const ing of INGREDIENTS) {
    const { data, error } = await sb
      .from("inventory_items")
      .insert({
        restaurant_id: restaurantId,
        name: ing.name,
        unit: ing.unit,
        item_type: "ingredient",
        category_id: categoryIds.get(`Stock/${ing.category}`) ?? null,
        supplier_id: supplierIds.get(ing.supplier) ?? null,
        purchase_unit: ing.purchaseUnit,
        units_per_purchase: ing.unitsPerPurchase,
        reference_purchase_unit_cost_ht: ing.cost,
        reference_purchase_is_benchmark: false,
        min_stock_qty: ing.minStock,
        target_stock_qty: ing.targetStock,
        current_stock_qty: 0, // alimenté par les mouvements de stock
        recipe_status: "validated",
        min_order_quantity: 1,
        order_multiple: 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Article « ${ing.name} » : ${error.message}`);
    itemIds.set(ing.name, (data as { id: string }).id);
  }

  // 2) Préparations maison : article de stock de type « prep ».
  for (const prep of PREPARATIONS) {
    const { data, error } = await sb
      .from("inventory_items")
      .insert({
        restaurant_id: restaurantId,
        name: prep.name,
        unit: prep.unit,
        item_type: "prep",
        category_id: categoryIds.get(`Stock/Préparations/${prep.category}`) ?? null,
        min_stock_qty: Math.round(prep.batchYield * 0.2),
        target_stock_qty: prep.batchYield,
        current_stock_qty: 0,
        recipe_status: "validated",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Préparation « ${prep.name} » : ${error.message}`);
    itemIds.set(prep.name, (data as { id: string }).id);
  }

  return itemIds;
}

/**
 * Composition des préparations (une préparation peut en contenir une autre).
 *
 * Le catalogue décrit une fabrication complète (« 800 g de carotte pour 4 L de
 * fond »), alors que `inventory_item_components.qty` attend la quantité **pour
 * une unité de la préparation**. On divise donc par le rendement du lot : sans
 * cela, l'explosion des recettes multiplie chaque composant par le rendement,
 * en cascade sur les préparations imbriquées.
 */
export async function seedPrepComponents(
  sb: SupabaseClient,
  restaurantId: string,
  itemIds: Map<string, string>
): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  for (const prep of PREPARATIONS) {
    const parentId = itemIds.get(prep.name);
    if (!parentId) throw new Error(`Préparation absente du stock : ${prep.name}`);
    for (const c of prep.components) {
      const componentId = itemIds.get(c.item);
      if (!componentId) throw new Error(`Composant « ${c.item} » introuvable (préparation ${prep.name})`);
      rows.push({
        restaurant_id: restaurantId,
        parent_item_id: parentId,
        component_item_id: componentId,
        qty: roundRecipeQty(c.qty / prep.batchYield),
      });
    }
  }
  const { error } = await sb.from("inventory_item_components").insert(rows);
  if (error) throw new Error(`Composition des préparations : ${error.message}`);
  return rows.length;
}

// ---------------------------------------------------------------------------
// CARTE
// ---------------------------------------------------------------------------

export async function seedDishes(
  sb: SupabaseClient,
  restaurantId: string,
  categoryIds: Map<string, string>,
  itemIds: Map<string, string>,
  supplierIds: Map<SupplierKey, string>
): Promise<Map<string, string>> {
  const dishIds = new Map<string, string>();

  for (const dish of DISHES) {
    // createDish adosse un article de stock aux plats de revente et pose recipe_status.
    const { data, error } = await createDish(restaurantId, dish.name, dish.mode, dish.ttc, dish.vat);
    if (error || !data) throw new Error(`Plat « ${dish.name} » : ${error?.message}`);
    dishIds.set(dish.name, data.id);

    const { error: upErr } = await sb
      .from("dishes")
      .update({
        category_id: categoryIds.get(dish.categoryPath) ?? null,
        menu_category: dish.menuCategory,
        description: dish.description ?? null,
        is_public: true,
      })
      .eq("id", data.id);
    if (upErr) throw new Error(`Rubrique du plat « ${dish.name} » : ${upErr.message}`);

    if (dish.mode === "resale" && dish.resaleItem) {
      await completeResaleItem(sb, restaurantId, dish, itemIds, categoryIds, supplierIds);
    }
  }

  // Recettes des plats préparés : après création de tous les articles.
  await seedDishComponents(sb, restaurantId, dishIds, itemIds);
  return dishIds;
}

/**
 * L'article de stock créé automatiquement pour un plat de revente n'a ni prix
 * d'achat ni fournisseur : on complète la fiche comme le ferait le restaurateur.
 */
async function completeResaleItem(
  sb: SupabaseClient,
  restaurantId: string,
  dish: DishDef,
  itemIds: Map<string, string>,
  categoryIds: Map<string, string>,
  supplierIds: Map<SupplierKey, string>
): Promise<void> {
  const r = dish.resaleItem!;
  const { data, error } = await sb
    .from("inventory_items")
    .update({
      supplier_id: supplierIds.get(r.supplier) ?? null,
      purchase_unit: r.purchaseUnit,
      units_per_purchase: r.unitsPerPurchase,
      reference_purchase_unit_cost_ht: r.cost,
      reference_purchase_is_benchmark: false,
      min_stock_qty: r.minStock,
      target_stock_qty: r.targetStock,
      category_id: categoryIds.get(`Stock/Boissons`) ?? null,
      min_order_quantity: 1,
      order_multiple: 1,
    })
    .eq("restaurant_id", restaurantId)
    .eq("name", dish.name)
    .eq("item_type", "resale")
    .select("id")
    .single();
  if (error) throw new Error(`Article de revente « ${dish.name} » : ${error.message}`);
  itemIds.set(dish.name, (data as { id: string }).id);
}

/** Recettes des plats préparés (les plats de revente sont déjà liés par createDish). */
async function seedDishComponents(
  sb: SupabaseClient,
  restaurantId: string,
  dishIds: Map<string, string>,
  itemIds: Map<string, string>
): Promise<void> {
  const rows: Record<string, unknown>[] = [];
  for (const dish of DISHES) {
    if (dish.mode !== "prepared" || !dish.recipe) continue;
    const dishId = dishIds.get(dish.name)!;
    for (const c of dish.recipe) {
      const itemId = itemIds.get(c.item);
      if (!itemId) throw new Error(`Composant « ${c.item} » introuvable (plat ${dish.name})`);
      rows.push({
        restaurant_id: restaurantId,
        dish_id: dishId,
        inventory_item_id: itemId,
        qty: c.qty,
      });
    }
  }
  const { error } = await sb.from("dish_components").insert(rows);
  if (error) throw new Error(`Recettes des plats : ${error.message}`);

  // Une recette saisie et vérifiée : le plat passe en « validated ».
  const preparedIds = DISHES.filter((d) => d.mode === "prepared").map((d) => dishIds.get(d.name)!);
  const { error: upErr } = await sb
    .from("dishes")
    .update({ recipe_status: "validated" })
    .in("id", preparedIds);
  if (upErr) throw new Error(`Statut des recettes : ${upErr.message}`);
}

/** Rubrique de stock dédiée aux boissons, créée à part car adossée aux plats de revente. */
export async function ensureBeverageStockCategory(
  sb: SupabaseClient,
  restaurantId: string,
  categoryIds: Map<string, string>
): Promise<void> {
  if (categoryIds.has("Stock/Boissons")) return;
  const parentId = categoryIds.get("Stock") ?? null;
  const { data, error } = await sb
    .from("restaurant_categories")
    .insert({
      restaurant_id: restaurantId,
      parent_id: parentId,
      name: "Boissons",
      sort_order: 900,
      applies_to: "inventory",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Rubrique stock boissons : ${error.message}`);
  categoryIds.set("Stock/Boissons", (data as { id: string }).id);
}

export { OPEN_DAYS };
