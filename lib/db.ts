import { supabaseServer } from "@/lib/supabaseServer";
import type { ServiceType } from "@/lib/constants";
import { DELIVERY_NOTES_BUCKET, SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";
import {
  buildMetadataPatchFromAnalysis,
  parseSupplierInvoiceAnalysis,
  type SupplierInvoiceAnalysisLine,
  type SupplierInvoiceAnalysisView,
} from "@/lib/supplier-invoice-analysis";
import {
  buildInvoiceReconciliation,
  type InvoiceReconciliationSummary,
} from "@/lib/invoice-reconciliation";
import { getCalculatedStockByItemForRestaurant } from "@/lib/stock/stockMovements";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import { ensureResaleDishStockBinding } from "@/lib/recipes/ensureResaleDishStockBinding";
import { toNumber } from "@/lib/utils/safeNumeric";
import {
  normalizeVatRatePct,
  roundSellingMoney,
  sellingPriceHtFromTtc,
} from "@/lib/tax/frenchSellingVat";

export type RecipeStatus = "missing" | "draft" | "validated";

export type Dish = {
  id: string;
  restaurant_id: string;
  name: string;
  name_normalized?: string | null;
  production_mode?: "prepared" | "resale" | null;
  recipe_status?: RecipeStatus | null;
  /** Rubrique carte (arborescence restaurant_categories). */
  category_id?: string | null;
  /** € TTC carte (portion) — saisie principale. */
  selling_price_ttc?: number | null;
  /** Taux TVA % (ex. 10, 20) pour déduire le HT. */
  selling_vat_rate_pct?: number | null;
  /** € HT dérivé : TTC / (1 + TVA/100), pour marge vs coût matière HT. */
  selling_price_ht?: number | null;
};

/** Forme attendue du jsonb analysis_result_json (écriture et lecture). */
export type AnalysisResultJson = {
  items: { name: string; qty: number }[];
  /** Lignes ignorées par l'utilisateur (à ne plus afficher en "non reconnues"). */
  ignored?: { rawLabel: string; qty: number }[];
};

/** Ligne extraite du ticket non matchée, avec candidats pour résolution rapide. */
export type UnknownLine = {
  rawLabel: string;
  normalizedLabel: string;
  qty: number;
  candidates: { dishId: string; dishName: string; score: number; reason: string }[];
};

/** Résultat de l'impact stock enregistré à la création du service. */
export type ServiceStockImpactJson = {
  applied_count: number;
  skipped_count: number;
  warnings: { type: string; dish_id?: string; item_id?: string; message: string }[];
};

export type Service = {
  id: string;
  restaurant_id: string;
  service_date: string;
  service_type: string;
  image_url: string | null;
  analysis_status: string | null;
  /** En lecture : objet si colonne jsonb, sinon string. */
  analysis_result_json: string | AnalysisResultJson | null;
  analysis_error: string | null;
  analysis_version: string | null;
  stock_impact_json?: ServiceStockImpactJson | null;
};

export type ServiceSale = {
  id: string;
  service_id: string;
  dish_id: string;
  qty: number;
  restaurant_id: string;
  /** Total € HT pour la ligne (optionnel) ; sinon marge réalisée = qty × prix carte. */
  line_total_ht?: number | null;
};

export type ServiceSaleWithDish = ServiceSale & {
  dishes: { name: string } | null;
};

/** Méthode de commande préférée pour un fournisseur. */
export type PreferredOrderMethod = "EMAIL" | "WHATSAPP" | "PHONE" | "PORTAL";

/** Fournisseur. */
export type Supplier = {
  id: string;
  restaurant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  address: string | null;
  notes: string | null;
  preferred_order_method: PreferredOrderMethod;
  order_days: string[];
  cut_off_time: string | null;
  lead_time_days: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Statut d'un brouillon de commande. */
export type OrderDraftStatus = "draft" | "ready_to_send" | "sent" | "confirmed";

/** Brouillon de commande fournisseur. */
export type OrderDraft = {
  id: string;
  restaurant_id: string;
  supplier_id: string;
  status: OrderDraftStatus;
  message_text: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Ligne d'un brouillon de commande (quantité en unité d'achat). */
export type OrderDraftLine = {
  id: string;
  order_draft_id: string;
  inventory_item_id: string;
  quantity: number;
};

/** Statut d'une commande fournisseur (purchase_order). */
export type PurchaseOrderStatus =
  | "generated"
  | "expected_delivery"
  | "partially_received"
  | "received"
  | "cancelled";

/** Commande fournisseur générée (historique). Ne modifie pas le stock. */
export type PurchaseOrder = {
  id: string;
  restaurant_id: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  generated_message: string | null;
  expected_delivery_date: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Ligne de commande fournisseur (snapshots pour traçabilité). */
export type PurchaseOrderLine = {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  ordered_qty_purchase_unit: number;
  purchase_unit: string;
  purchase_to_stock_ratio: number;
  supplier_sku_snapshot: string | null;
  item_name_snapshot: string;
  created_at?: string;
};

/** Bon de livraison / réception fournisseur. */
export type DeliveryNote = {
  id: string;
  restaurant_id: string;
  supplier_id: string;
  purchase_order_id: string | null;
  number?: string | null;
  delivery_date?: string | null;
  source: "from_purchase_order" | "from_upload";
  notes?: string | null;
  file_path: string | null;
  file_name: string | null;
  file_url?: string | null;
  raw_text?: string | null;
  status: "draft" | "received" | "validated";
  created_at?: string;
  updated_at?: string;
};

/** Ligne de réception (delivery_note_lines). qty_ordered/qty_delivered = unité achat, qty_received = unité stock. */
export type DeliveryNoteLine = {
  id: string;
  delivery_note_id: string;
  purchase_order_line_id: string | null;
  inventory_item_id: string | null;
  label: string;
  qty_ordered: number;
  qty_delivered: number;
  qty_received: number;
  unit: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  /** Total ligne HT sur le BL (€), prioritaire pour le coût unitaire = total / qty_received. */
  bl_line_total_ht?: number | null;
  /** Prix unitaire HT sur le BL en unité de stock (€). */
  bl_unit_price_stock_ht?: number | null;
  /** Coût unitaire HT saisi (€ / unité de stock), prioritaire sur liaison et BL. */
  manual_unit_price_stock_ht?: number | null;
  /** Ligne de facture extraite liée (même facture que la réception). */
  supplier_invoice_extracted_line_id?: string | null;
  /** Ratio achat -> stock (ex: 1 carton = 24 unités). Rempli via jointure purchase_order_lines. */
  purchase_to_stock_ratio?: number;
  /** Unité de stock (inventory_items.unit). */
  stock_unit?: string | null;
  /** Température à la réception (°C), suivi hygiène ; optionnel. */
  received_temperature_celsius?: number | null;
  /** Numéro de lot (traçabilité). */
  lot_number?: string | null;
  /** Date limite de consommation / péremption (DLC), format date ISO (YYYY-MM-DD). */
  expiry_date?: string | null;
  /** Horodatage du contrôle physique (ligne validée par l’opérateur). */
  reception_line_verified_at?: string | null;
};

/** Photo de traçabilité liée à une ligne de réception. */
export type ReceptionTraceabilityPhoto = {
  id: string;
  delivery_note_line_id: string;
  storage_path: string;
  file_url: string | null;
  element_type: string;
  created_at: string;
};

/** Facture fournisseur (supplier_invoices). */
export type SupplierInvoice = {
  id: string;
  restaurant_id: string;
  supplier_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_url: string | null;
  amount_ht: number | null;
  amount_ttc: number | null;
  status: "draft" | "linked" | "reviewed";
  created_at?: string;
  updated_at?: string;
  analysis_result_json?: unknown | null;
  analysis_status?: string | null;
  analysis_error?: string | null;
  analysis_version?: string | null;
};

/** Composant stockable (matière première, préparation, revente). */
export type InventoryItem = {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  item_type: "ingredient" | "prep" | "resale";
  /** Rubrique stock (arborescence restaurant_categories). */
  category_id?: string | null;
  current_stock_qty: number;
  min_stock_qty?: number | null;
  recipe_status?: RecipeStatus | null;
  created_at?: string;
  supplier_id?: string | null;
  supplier_sku?: string | null;
  purchase_unit?: string | null;
  units_per_purchase?: number | null;
  min_order_quantity?: number | null;
  order_multiple?: number | null;
  target_stock_qty?: number | null;
  /** € HT / unité de stock, saisi sur la fiche ; repli coût réception si pas d’autre source. */
  reference_purchase_unit_cost_ht?: number | null;
};

/** Liste inventaire enrichie couche 2 (stock calculé depuis les mouvements). */
export type InventoryItemWithCalculatedStock = InventoryItem & {
  stock_qty_from_movements: number;
};

/** Ligne de composition d'une préparation (inventory_item_components). */
export type InventoryItemComponent = {
  id: string;
  restaurant_id: string;
  parent_item_id: string;
  component_item_id: string;
  qty: number;
  created_at?: string;
};

/** Ligne de composition d'un plat (dish_components). */
export type DishComponent = {
  id: string;
  restaurant_id: string;
  dish_id: string;
  inventory_item_id: string;
  qty: number;
  created_at?: string;
};

/** Alias / abréviation pour un plat (table dish_aliases). */
export type DishAlias = {
  id: string;
  restaurant_id: string;
  dish_id: string;
  alias: string;
  alias_normalized?: string | null;
  created_at?: string;
};

/** Liste des plats pour un restaurant. */
export async function getDishes(restaurantId: string): Promise<{ data: Dish[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dishes")
    .select(
      "id, restaurant_id, name, name_normalized, production_mode, recipe_status, category_id, selling_price_ht, selling_price_ttc, selling_vat_rate_pct"
    )
    .eq("restaurant_id", restaurantId)
    .order("name");

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as Dish[], error: null };
}

/** Récupère un plat par id. */
export async function getDish(dishId: string): Promise<{ data: Dish | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dishes")
    .select(
      "id, restaurant_id, name, name_normalized, production_mode, recipe_status, category_id, selling_price_ht, selling_price_ttc, selling_vat_rate_pct"
    )
    .eq("id", dishId)
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as Dish, error: null };
}

/** Crée un service et retourne l'objet avec id. */
export async function createService(
  restaurantId: string,
  serviceDate: string,
  serviceType: ServiceType,
  imageUrl?: string | null
): Promise<{ data: Service | null; error: Error | null }> {
  const payload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    service_date: serviceDate,
    service_type: serviceType,
  };
  if (imageUrl != null) payload.image_url = imageUrl;

  const { data, error } = await supabaseServer
    .from("services")
    .insert(payload)
    .select("id, restaurant_id, service_date, service_type, image_url, analysis_status, analysis_result_json, analysis_error, analysis_version")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as Service, error: null };
}

/** Crée les ventes d'un service. */
export async function createServiceSales(
  serviceId: string,
  restaurantId: string,
  sales: { dish_id: string; qty: number }[]
): Promise<{ error: Error | null }> {
  const rows = sales
    .filter((s) => s.qty > 0)
    .map((s) => ({
      service_id: serviceId,
      dish_id: s.dish_id,
      qty: s.qty,
      restaurant_id: restaurantId,
    }));

  if (rows.length === 0) return { error: null };

  const { error } = await supabaseServer.from("service_sales").insert(rows);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Récupère un service par id. */
export async function getService(serviceId: string): Promise<{ data: Service | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("services")
    .select("id, restaurant_id, service_date, service_type, image_url, analysis_status, analysis_result_json, analysis_error, analysis_version, stock_impact_json")
    .eq("id", serviceId)
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as Service, error: null };
}

export type ServiceAnalysisUpdate = {
  analysis_status: string;
  /** Objet JSON compatible jsonb (pas de stringify). */
  analysis_result_json: AnalysisResultJson | null;
  analysis_error: string | null;
  analysis_version: string | null;
};

/** Met à jour les champs d'analyse d'un service. */
export async function updateServiceAnalysis(
  serviceId: string,
  update: ServiceAnalysisUpdate
): Promise<{ error: Error | null }> {
  console.log("[updateServiceAnalysis] update lancé", { serviceId });
  console.log("[updateServiceAnalysis] update payload =", JSON.stringify(update));

  const { error } = await supabaseServer
    .from("services")
    .update(update)
    .eq("id", serviceId);

  if (error) {
    console.error("[updateServiceAnalysis] update échoué", { serviceId, error: error.message, code: error.code });
    return { error: new Error(error.message) };
  }
  console.log("[updateServiceAnalysis] update réussi", { serviceId });

  const { data: reread, error: rereadError } = await supabaseServer
    .from("services")
    .select("id, analysis_status, analysis_result_json")
    .eq("id", serviceId)
    .maybeSingle();

  if (rereadError) {
    console.error("[updateServiceAnalysis] relecture échouée", { serviceId, error: rereadError.message });
    return { error: null };
  }
  console.log("[updateServiceAnalysis] relecture réussie", { serviceId, analysis_status: reread?.analysis_status, analysis_result_json: reread?.analysis_result_json });
  return { error: null };
}

/** Met à jour le résumé d'impact stock d'un service (après enregistrement). */
export async function updateServiceStockImpact(
  serviceId: string,
  payload: ServiceStockImpactJson
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("services")
    .update({ stock_impact_json: payload })
    .eq("id", serviceId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** Liste des services d'un restaurant (pour historique), du plus récent au plus ancien. */
export async function getServicesForRestaurant(
  restaurantId: string,
  limit = 100
): Promise<{ data: Service[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("services")
    .select("id, restaurant_id, service_date, service_type, image_url, analysis_status, analysis_result_json, analysis_error, analysis_version, stock_impact_json")
    .eq("restaurant_id", restaurantId)
    .order("service_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as Service[], error: null };
}

/** Supprime un service : d'abord les ventes (service_sales), puis le service. service_import_lines en CASCADE si défini. */
export async function deleteService(serviceId: string): Promise<{ error: Error | null }> {
  const { error: salesErr } = await supabaseServer
    .from("service_sales")
    .delete()
    .eq("service_id", serviceId);
  if (salesErr) return { error: new Error(salesErr.message) };

  const { error: serviceErr } = await supabaseServer
    .from("services")
    .delete()
    .eq("id", serviceId);
  if (serviceErr) return { error: new Error(serviceErr.message) };
  return { error: null };
}

/** Agrégat ventes par service_id (nombre de lignes, quantité totale). */
export async function getServiceSalesAggregate(
  serviceIds: string[]
): Promise<{ data: Map<string, { lines: number; totalQty: number }>; error: Error | null }> {
  if (serviceIds.length === 0) return { data: new Map(), error: null };
  const { data, error } = await supabaseServer
    .from("service_sales")
    .select("service_id, qty")
    .in("service_id", serviceIds);
  if (error) return { data: new Map(), error: new Error(error.message) };
  const map = new Map<string, { lines: number; totalQty: number }>();
  for (const id of serviceIds) map.set(id, { lines: 0, totalQty: 0 });
  for (const row of data ?? []) {
    const qty = Number((row as { qty: unknown }).qty) || 0;
    const cur = map.get((row as { service_id: string }).service_id)!;
    cur.lines += 1;
    cur.totalQty += qty;
  }
  return { data: map, error: null };
}

/** Liste des alias de plats pour un restaurant. */
export async function getDishAliases(
  restaurantId: string
): Promise<{ data: DishAlias[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dish_aliases")
    .select("id, restaurant_id, dish_id, alias, alias_normalized, created_at")
    .eq("restaurant_id", restaurantId);

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as DishAlias[], error: null };
}

/** Récupère les ventes d'un service avec le nom du plat (join dishes). */
export async function getServiceSalesWithDishes(
  serviceId: string
): Promise<{ data: ServiceSaleWithDish[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("service_sales")
    .select("id, service_id, dish_id, qty, restaurant_id, line_total_ht, dishes(name)")
    .eq("service_id", serviceId);

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as unknown as ServiceSaleWithDish[], error: null };
}

/** Crée un plat et remplit name_normalized. */
export async function createDish(
  restaurantId: string,
  name: string,
  productionMode?: "prepared" | "resale" | null,
  sellingPriceTtc?: number | null,
  sellingVatRatePct?: number | null
): Promise<{ data: Dish | null; error: Error | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { data: null, error: new Error("Nom du plat requis.") };
  const name_normalized = normalizeDishLabel(trimmed);
  const payload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    name: trimmed,
    name_normalized: name_normalized || null,
  };
  if (productionMode != null) payload.production_mode = productionMode;
  const vat = normalizeVatRatePct(sellingVatRatePct ?? 10, 10);
  payload.selling_vat_rate_pct = vat;
  if (sellingPriceTtc != null && Number.isFinite(sellingPriceTtc) && sellingPriceTtc > 0) {
    const ttc = roundSellingMoney(sellingPriceTtc);
    payload.selling_price_ttc = ttc;
    payload.selling_price_ht = sellingPriceHtFromTtc(ttc, vat);
  }
  const { data, error } = await supabaseServer
    .from("dishes")
    .insert(payload)
    .select(
      "id, restaurant_id, name, name_normalized, production_mode, recipe_status, selling_price_ht, selling_price_ttc, selling_vat_rate_pct"
    )
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  const dish = data as Dish;
  if (dish.production_mode === "resale") {
    const bind = await ensureResaleDishStockBinding(restaurantId, dish.id, dish.name);
    if (bind.error) {
      await supabaseServer.from("dishes").delete().eq("id", dish.id).eq("restaurant_id", restaurantId);
      return { data: null, error: bind.error };
    }
    return { data: { ...dish, recipe_status: "validated" }, error: null };
  }
  return { data: dish, error: null };
}

/** Crée un alias et remplit alias_normalized. Échoue si (restaurant_id, alias_normalized) existe déjà. */
export async function createDishAlias(
  restaurantId: string,
  dishId: string,
  alias: string
): Promise<{ data: DishAlias | null; error: Error | null }> {
  const trimmed = alias.trim();
  if (!trimmed) return { data: null, error: new Error("Alias requis.") };
  const alias_normalized = normalizeDishLabel(trimmed);
  const { data, error } = await supabaseServer
    .from("dish_aliases")
    .insert({ restaurant_id: restaurantId, dish_id: dishId, alias: trimmed, alias_normalized: alias_normalized || null })
    .select("id, restaurant_id, dish_id, alias, alias_normalized, created_at")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as DishAlias, error: null };
}

// --- Inventory & recipe (recettes / stock) ---

const INVENTORY_ITEM_SELECT =
  "id, restaurant_id, name, unit, item_type, category_id, current_stock_qty, min_stock_qty, recipe_status, created_at, supplier_id, supplier_sku, purchase_unit, units_per_purchase, min_order_quantity, order_multiple, target_stock_qty, reference_purchase_unit_cost_ht";

/** Liste des composants stockables du restaurant. */
export async function getInventoryItems(
  restaurantId: string
): Promise<{ data: InventoryItem[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("inventory_items")
    .select(INVENTORY_ITEM_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("name");

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as InventoryItem[], error: null };
}

/**
 * Composants + stock calculé (somme des mouvements). L’UI et les alertes s’appuient sur `stock_qty_from_movements` ; la fiche garde `current_stock_qty` alignée lors des écritures métier.
 */
export async function getInventoryItemsWithCalculatedStock(
  restaurantId: string
): Promise<{ data: InventoryItemWithCalculatedStock[] | null; error: Error | null }> {
  const [itemsRes, calcRes] = await Promise.all([
    getInventoryItems(restaurantId),
    getCalculatedStockByItemForRestaurant(restaurantId),
  ]);
  if (itemsRes.error) return { data: null, error: itemsRes.error };
  if (calcRes.error) return { data: null, error: calcRes.error };

  const map = calcRes.data;
  const merged = (itemsRes.data ?? []).map((item) => ({
    ...item,
    stock_qty_from_movements: map.get(item.id) ?? 0,
  }));
  return { data: merged, error: null };
}

/** Récupère un composant par id. */
export async function getInventoryItem(
  itemId: string
): Promise<{ data: InventoryItem | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("inventory_items")
    .select(INVENTORY_ITEM_SELECT)
    .eq("id", itemId)
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as InventoryItem, error: null };
}

/** Composants d'une préparation (parent = prep). */
export async function getInventoryItemComponents(
  parentItemId: string
): Promise<{ data: InventoryItemComponent[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("inventory_item_components")
    .select("id, restaurant_id, parent_item_id, component_item_id, qty, created_at")
    .eq("parent_item_id", parentItemId);

  if (error) return { data: null, error: new Error(error.message) };
  const rows = (data ?? []) as (Omit<InventoryItemComponent, "qty"> & { qty: unknown })[];
  const normalized = rows.map((r) => ({ ...r, qty: toNumber(r.qty) })) as InventoryItemComponent[];
  return { data: normalized, error: null };
}

/** Composants d'un plat (dish_components). */
export async function getDishComponents(
  dishId: string
): Promise<{ data: DishComponent[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dish_components")
    .select("id, restaurant_id, dish_id, inventory_item_id, qty, created_at")
    .eq("dish_id", dishId);

  if (error) return { data: null, error: new Error(error.message) };
  const rows = (data ?? []) as (Omit<DishComponent, "qty"> & { qty: unknown })[];
  const normalized = rows.map((r) => ({ ...r, qty: toNumber(r.qty) })) as DishComponent[];
  return { data: normalized, error: null };
}

// --- Fournisseurs (suppliers) ---

/** Liste des fournisseurs du restaurant. */
export async function getSuppliers(
  restaurantId: string,
  activeOnly = false
): Promise<{ data: Supplier[] | null; error: Error | null }> {
  let q = supabaseServer
    .from("suppliers")
    .select("id, restaurant_id, name, email, phone, whatsapp_phone, address, notes, preferred_order_method, order_days, cut_off_time, lead_time_days, is_active, created_at, updated_at")
    .eq("restaurant_id", restaurantId)
    .order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as Supplier[], error: null };
}

/** Récupère un fournisseur par id. */
export async function getSupplier(
  supplierId: string
): Promise<{ data: Supplier | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("suppliers")
    .select("id, restaurant_id, name, email, phone, whatsapp_phone, address, notes, preferred_order_method, order_days, cut_off_time, lead_time_days, is_active, created_at, updated_at")
    .eq("id", supplierId)
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as Supplier, error: null };
}

export type CreateSupplierPayload = {
  restaurant_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  address?: string | null;
  notes?: string | null;
  preferred_order_method?: PreferredOrderMethod;
  order_days?: string[];
  cut_off_time?: string | null;
  lead_time_days?: number | null;
  is_active?: boolean;
};

/** Crée un fournisseur. */
export async function createSupplier(
  payload: CreateSupplierPayload
): Promise<{ data: Supplier | null; error: Error | null }> {
  const name = payload.name?.trim();
  if (!name) return { data: null, error: new Error("Nom du fournisseur requis.") };
  const row = {
    restaurant_id: payload.restaurant_id,
    name,
    email: payload.email?.trim() || null,
    phone: payload.phone?.trim() || null,
    whatsapp_phone: payload.whatsapp_phone?.trim() || null,
    address: payload.address?.trim() || null,
    notes: payload.notes?.trim() || null,
    preferred_order_method: payload.preferred_order_method ?? "EMAIL",
    order_days: Array.isArray(payload.order_days) ? payload.order_days : [],
    cut_off_time: payload.cut_off_time || null,
    lead_time_days: payload.lead_time_days ?? null,
    is_active: payload.is_active ?? true,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseServer.from("suppliers").insert(row).select().single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as Supplier, error: null };
}

export type UpdateSupplierPayload = Partial<Omit<CreateSupplierPayload, "restaurant_id">>;

/** Met à jour un fournisseur. */
export async function updateSupplier(
  supplierId: string,
  payload: UpdateSupplierPayload
): Promise<{ error: Error | null }> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.email !== undefined) updates.email = payload.email?.trim() || null;
  if (payload.phone !== undefined) updates.phone = payload.phone?.trim() || null;
  if (payload.whatsapp_phone !== undefined) updates.whatsapp_phone = payload.whatsapp_phone?.trim() || null;
  if (payload.address !== undefined) updates.address = payload.address?.trim() || null;
  if (payload.notes !== undefined) updates.notes = payload.notes?.trim() || null;
  if (payload.preferred_order_method !== undefined) updates.preferred_order_method = payload.preferred_order_method;
  if (payload.order_days !== undefined) updates.order_days = payload.order_days;
  if (payload.cut_off_time !== undefined) updates.cut_off_time = payload.cut_off_time || null;
  if (payload.lead_time_days !== undefined) updates.lead_time_days = payload.lead_time_days;
  if (payload.is_active !== undefined) updates.is_active = payload.is_active;
  const { error } = await supabaseServer.from("suppliers").update(updates).eq("id", supplierId);
  return { error: error ? new Error(error.message) : null };
}

// --- Brouillons de commande (order_drafts) ---

/** Lignes d'un brouillon avec infos composant. */
export type OrderDraftLineWithItem = OrderDraftLine & {
  inventory_items: { name: string; unit: string; purchase_unit: string | null; supplier_sku: string | null } | null;
};

/** Brouillon avec fournisseur et lignes. */
export type OrderDraftWithDetails = OrderDraft & {
  suppliers: Supplier | null;
  order_draft_lines: OrderDraftLineWithItem[];
};

export async function getOrderDraft(
  draftId: string
): Promise<{ data: OrderDraftWithDetails | null; error: Error | null }> {
  const { data: draft, error: draftErr } = await supabaseServer
    .from("order_drafts")
    .select("id, restaurant_id, supplier_id, status, message_text, created_at, updated_at")
    .eq("id", draftId)
    .single();
  if (draftErr || !draft) return { data: null, error: draftErr ? new Error(draftErr.message) : null };

  const { data: supplier } = await getSupplier((draft as OrderDraft).supplier_id);
  const { data: linesData } = await supabaseServer
    .from("order_draft_lines")
    .select("id, order_draft_id, inventory_item_id, quantity")
    .eq("order_draft_id", draftId);

  const linesWithItem = await Promise.all(
    ((linesData ?? []) as OrderDraftLine[]).map(async (line) => {
      const { data: item } = await supabaseServer
        .from("inventory_items")
        .select("name, unit, purchase_unit, supplier_sku")
        .eq("id", line.inventory_item_id)
        .single();
      return { ...line, inventory_items: item } as OrderDraftLineWithItem;
    })
  );

  return {
    data: {
      ...(draft as OrderDraft),
      suppliers: supplier ?? null,
      order_draft_lines: linesWithItem,
    },
    error: null,
  };
}

export async function createOrderDraft(
  restaurantId: string,
  supplierId: string,
  lines: { inventory_item_id: string; quantity: number }[]
): Promise<{ data: OrderDraft | null; error: Error | null }> {
  const { data: draft, error: draftErr } = await supabaseServer
    .from("order_drafts")
    .insert({ restaurant_id: restaurantId, supplier_id: supplierId, status: "draft", updated_at: new Date().toISOString() })
    .select("id, restaurant_id, supplier_id, status, message_text, created_at, updated_at")
    .single();
  if (draftErr || !draft) return { data: null, error: draftErr ? new Error(draftErr.message) : null };

  if (lines.length > 0) {
    const rows = lines.map((l) => ({
      order_draft_id: (draft as OrderDraft).id,
      inventory_item_id: l.inventory_item_id,
      quantity: l.quantity,
    }));
    const { error: linesErr } = await supabaseServer.from("order_draft_lines").insert(rows);
    if (linesErr) return { data: null, error: new Error(linesErr.message) };
  }
  return { data: draft as OrderDraft, error: null };
}

export async function updateOrderDraftMessage(
  draftId: string,
  messageText: string | null
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("order_drafts")
    .update({ message_text: messageText, updated_at: new Date().toISOString() })
    .eq("id", draftId);
  return { error: error ? new Error(error.message) : null };
}

export async function updateOrderDraftLineQuantity(
  lineId: string,
  quantity: number
): Promise<{ error: Error | null }> {
  if (quantity <= 0) return { error: new Error("La quantité doit être positive.") };
  const { error } = await supabaseServer.from("order_draft_lines").update({ quantity }).eq("id", lineId);
  return { error: error ? new Error(error.message) : null };
}

export async function updateOrderDraftStatus(
  draftId: string,
  status: OrderDraftStatus
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("order_drafts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", draftId);
  return { error: error ? new Error(error.message) : null };
}

// --- Commandes fournisseurs (purchase_orders) ---
// Convention module achats : toute référence à un composant stocké = inventory_item_id (jamais ingredient_id, component_id, item_id).
// Règle métier : générer une commande ne modifie pas le stock ; seule une réception validée (BL) peut l'augmenter.

export async function getPurchaseOrders(
  restaurantId: string,
  options?: { supplierId?: string }
): Promise<{ data: PurchaseOrder[] | null; error: Error | null }> {
  let q = supabaseServer
    .from("purchase_orders")
    .select("id, restaurant_id, supplier_id, status, generated_message, expected_delivery_date, created_at, updated_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (options?.supplierId) q = q.eq("supplier_id", options.supplierId);
  const { data, error } = await q;
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as PurchaseOrder[], error: null };
}

export type PurchaseOrderWithDetails = PurchaseOrder & {
  supplier: Supplier | null;
  lines: PurchaseOrderLine[];
  delivery_notes: DeliveryNote[];
};

export async function getPurchaseOrder(
  orderId: string
): Promise<{ data: PurchaseOrderWithDetails | null; error: Error | null }> {
  const { data: order, error: orderErr } = await supabaseServer
    .from("purchase_orders")
    .select("id, restaurant_id, supplier_id, status, generated_message, expected_delivery_date, created_at, updated_at")
    .eq("id", orderId)
    .single();
  if (orderErr || !order) return { data: null, error: orderErr ? new Error(orderErr.message) : null };

  const [supplierRes, linesRes, notesRes] = await Promise.all([
    getSupplier((order as PurchaseOrder).supplier_id),
    supabaseServer
      .from("purchase_order_lines")
      .select("id, purchase_order_id, inventory_item_id, ordered_qty_purchase_unit, purchase_unit, purchase_to_stock_ratio, supplier_sku_snapshot, item_name_snapshot, created_at")
      .eq("purchase_order_id", orderId),
    supabaseServer
      .from("delivery_notes")
      .select("id, restaurant_id, supplier_id, purchase_order_id, file_path, file_name, status, created_at, updated_at")
      .eq("purchase_order_id", orderId)
      .order("created_at", { ascending: false }),
  ]);

  const lines = (linesRes.data ?? []) as PurchaseOrderLine[];
  const delivery_notes = (notesRes.data ?? []) as DeliveryNote[];

  return {
    data: {
      ...(order as PurchaseOrder),
      supplier: supplierRes.data ?? null,
      lines,
      delivery_notes,
    },
    error: null,
  };
}

export async function createPurchaseOrder(params: {
  restaurantId: string;
  supplierId: string;
  generatedMessage: string | null;
  expectedDeliveryDate?: string | null;
  lines: {
    inventory_item_id: string;
    ordered_qty_purchase_unit: number;
    purchase_unit: string;
    purchase_to_stock_ratio: number;
    supplier_sku_snapshot: string | null;
    item_name_snapshot: string;
  }[];
}): Promise<{ data: PurchaseOrder | null; error: Error | null }> {
  const { restaurantId, supplierId, generatedMessage, expectedDeliveryDate, lines } = params;
  const now = new Date().toISOString();
  const { data: order, error: orderErr } = await supabaseServer
    .from("purchase_orders")
    .insert({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      status: "generated",
      generated_message: generatedMessage ?? null,
      expected_delivery_date: expectedDeliveryDate ?? null,
      updated_at: now,
    })
    .select("id, restaurant_id, supplier_id, status, generated_message, expected_delivery_date, created_at, updated_at")
    .single();
  if (orderErr || !order) return { data: null, error: orderErr ? new Error(orderErr.message) : null };

  if (lines.length > 0) {
    const rows = lines.map((l) => ({
      purchase_order_id: (order as PurchaseOrder).id,
      inventory_item_id: l.inventory_item_id,
      ordered_qty_purchase_unit: l.ordered_qty_purchase_unit,
      purchase_unit: l.purchase_unit,
      purchase_to_stock_ratio: l.purchase_to_stock_ratio,
      supplier_sku_snapshot: l.supplier_sku_snapshot ?? null,
      item_name_snapshot: l.item_name_snapshot,
    }));
    const { error: linesErr } = await supabaseServer.from("purchase_order_lines").insert(rows);
    if (linesErr) return { data: null, error: new Error(linesErr.message) };
  }

  return { data: order as PurchaseOrder, error: null };
}

export async function updatePurchaseOrderExpectedDelivery(
  orderId: string,
  expectedDeliveryDate: string | null
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("purchase_orders")
    .update({ expected_delivery_date: expectedDeliveryDate, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  return { error: error ? new Error(error.message) : null };
}

export async function updatePurchaseOrderStatus(
  orderId: string,
  status: PurchaseOrderStatus
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("purchase_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  return { error: error ? new Error(error.message) : null };
}

export async function deletePurchaseOrder(
  orderId: string,
  restaurantId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("purchase_orders")
    .delete()
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId);
  return { error: error ? new Error(error.message) : null };
}

// --- Bons de livraison (delivery_notes) ---

export type DeliveryNoteForList = DeliveryNote & { lines_count: number };

export async function getDeliveryNotesBySupplier(
  supplierId: string
): Promise<{ data: DeliveryNoteForList[] | null; error: Error | null }> {
  const { data: notes, error } = await supabaseServer
    .from("delivery_notes")
    .select(
      "id, restaurant_id, supplier_id, purchase_order_id, number, delivery_date, source, file_path, file_name, file_url, status, created_at, updated_at"
    )
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: new Error(error.message) };
  const list = (notes ?? []) as DeliveryNote[];
  if (list.length === 0) return { data: [], error: null };

  const noteIds = list.map((n) => n.id);
  const { data: linesData } = await supabaseServer
    .from("delivery_note_lines")
    .select("delivery_note_id")
    .in("delivery_note_id", noteIds);
  const countByNoteId: Record<string, number> = {};
  for (const row of linesData ?? []) {
    const id = (row as { delivery_note_id: string }).delivery_note_id;
    countByNoteId[id] = (countByNoteId[id] ?? 0) + 1;
  }
  const result: DeliveryNoteForList[] = list.map((n) => ({
    ...n,
    lines_count: countByNoteId[n.id] ?? 0,
  }));
  return { data: result, error: null };
}

/** Réceptions récentes du restaurant (tous fournisseurs), pour l’écran Livraison. */
export async function getRecentDeliveryNotesForRestaurant(
  restaurantId: string,
  limit = 30
): Promise<{ data: DeliveryNoteForList[] | null; error: Error | null }> {
  const { data: notes, error } = await supabaseServer
    .from("delivery_notes")
    .select(
      "id, restaurant_id, supplier_id, purchase_order_id, number, delivery_date, source, file_path, file_name, file_url, status, created_at, updated_at"
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: new Error(error.message) };
  const list = (notes ?? []) as DeliveryNote[];
  if (list.length === 0) return { data: [], error: null };

  const noteIds = list.map((n) => n.id);
  const { data: linesData } = await supabaseServer
    .from("delivery_note_lines")
    .select("delivery_note_id")
    .in("delivery_note_id", noteIds);
  const countByNoteId: Record<string, number> = {};
  for (const row of linesData ?? []) {
    const id = (row as { delivery_note_id: string }).delivery_note_id;
    countByNoteId[id] = (countByNoteId[id] ?? 0) + 1;
  }
  const result: DeliveryNoteForList[] = list.map((n) => ({
    ...n,
    lines_count: countByNoteId[n.id] ?? 0,
  }));
  return { data: result, error: null };
}

export async function createDeliveryNoteFromUpload(params: {
  restaurantId: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  filePath: string;
  fileName: string;
  fileUrl: string | null;
}): Promise<{ data: DeliveryNote | null; error: Error | null }> {
  const { restaurantId, supplierId, purchaseOrderId, filePath, fileName, fileUrl } = params;
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("delivery_notes")
    .insert({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      purchase_order_id: purchaseOrderId ?? null,
      source: "from_upload",
      file_path: filePath,
      file_name: fileName,
      file_url: fileUrl,
      status: "draft",
      updated_at: now,
    })
    .select(
      "id, restaurant_id, supplier_id, purchase_order_id, number, delivery_date, source, notes, file_path, file_name, file_url, raw_text, status, created_at, updated_at"
    )
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as DeliveryNote, error: null };
}

export { DELIVERY_NOTES_BUCKET };

export function getDeliveryNoteFileUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  const { data } = supabaseServer.storage.from(DELIVERY_NOTES_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export type DeliveryNoteWithLines = DeliveryNote & {
  lines: (DeliveryNoteLine & {
    inventory_items: { name: string } | null;
    traceability_photos?: ReceptionTraceabilityPhoto[];
  })[];
};

/** Ligne du registre photos traçabilité (filtres date / type / lot). */
export type ReceptionTraceabilityRegisterRow = {
  id: string;
  created_at: string;
  storage_path: string;
  file_url: string | null;
  element_type: string;
  delivery_note_id: string;
  delivery_date: string | null;
  bl_number: string | null;
  supplier_name: string | null;
  line_label: string;
  lot_number: string | null;
  expiry_date: string | null;
  product_name: string | null;
};

/** Lignes extraites d’une facture (liste pour liaison BL). */
export type InvoiceExtractedLineOption = {
  id: string;
  label: string;
  line_total: number | null;
  unit_price: number | null;
  quantity: number | null;
  sort_order: number;
};

export async function getInvoiceExtractedLinesForInvoice(
  supplierInvoiceId: string,
  restaurantId: string
): Promise<{ data: InvoiceExtractedLineOption[]; error: Error | null }> {
  const { data: inv, error: invErr } = await supabaseServer
    .from("supplier_invoices")
    .select("id")
    .eq("id", supplierInvoiceId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (invErr) return { data: [], error: new Error(invErr.message) };
  if (!inv) return { data: [], error: null };

  const { data, error } = await supabaseServer
    .from("supplier_invoice_extracted_lines")
    .select("id, label, line_total, unit_price, quantity, sort_order")
    .eq("supplier_invoice_id", supplierInvoiceId)
    .order("sort_order", { ascending: true });
  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data ?? []) as {
    id: string;
    label: string;
    line_total: unknown;
    unit_price: unknown;
    quantity: unknown;
    sort_order: unknown;
  }[];

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      label: String(r.label ?? "—"),
      line_total:
        r.line_total == null || r.line_total === ""
          ? null
          : Number(r.line_total),
      unit_price:
        r.unit_price == null || r.unit_price === ""
          ? null
          : Number(r.unit_price),
      quantity:
        r.quantity == null || r.quantity === "" ? null : Number(r.quantity),
      sort_order: Number(r.sort_order) || 0,
    })),
    error: null,
  };
}

export async function getDeliveryNoteWithLines(
  id: string
): Promise<{ data: DeliveryNoteWithLines | null; error: Error | null }> {
  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .select(
      "id, restaurant_id, supplier_id, purchase_order_id, number, delivery_date, source, notes, file_path, file_name, file_url, raw_text, status, created_at, updated_at"
    )
    .eq("id", id)
    .single();
  if (noteErr || !note) return { data: null, error: noteErr ? new Error(noteErr.message) : null };

  const { data: linesData, error: linesErr } = await supabaseServer
    .from("delivery_note_lines")
    .select(
      "id, delivery_note_id, purchase_order_line_id, inventory_item_id, label, qty_ordered, qty_delivered, qty_received, unit, sort_order, created_at, updated_at, bl_line_total_ht, bl_unit_price_stock_ht, manual_unit_price_stock_ht, supplier_invoice_extracted_line_id, received_temperature_celsius, lot_number, expiry_date, reception_line_verified_at, inventory_items(name, unit), purchase_order_lines(purchase_to_stock_ratio)"
    )
    .eq("delivery_note_id", id)
    .order("sort_order", { ascending: true });
  if (linesErr) return { data: null, error: new Error(linesErr.message) };

  type LinesRow = Record<string, unknown> & {
    inventory_items?: { name?: string; unit?: string } | { name?: string; unit?: string }[] | null;
    purchase_order_lines?: { purchase_to_stock_ratio?: number } | { purchase_to_stock_ratio?: number }[] | null;
  };
  const lines = (linesData ?? []).map((l: LinesRow) => {
    const invRaw = Array.isArray(l.inventory_items) ? l.inventory_items[0] : l.inventory_items;
    const inv = invRaw && (invRaw as { name?: string })?.name != null
      ? { name: String((invRaw as { name: string }).name), unit: (invRaw as { unit?: string })?.unit ?? null }
      : null;
    const polRaw = Array.isArray(l.purchase_order_lines) ? l.purchase_order_lines[0] : l.purchase_order_lines;
    const ratio = polRaw != null && typeof (polRaw as { purchase_to_stock_ratio?: number }).purchase_to_stock_ratio === "number"
      ? Number((polRaw as { purchase_to_stock_ratio: number }).purchase_to_stock_ratio)
      : undefined;

    return {
      id: String(l.id),
      delivery_note_id: String(l.delivery_note_id),
      purchase_order_line_id: l.purchase_order_line_id == null ? null : String(l.purchase_order_line_id),
      inventory_item_id: l.inventory_item_id == null ? null : String(l.inventory_item_id),
      label: String(l.label),
      qty_ordered: Number(l.qty_ordered) || 0,
      qty_delivered: Number(l.qty_delivered) || 0,
      qty_received: Number(l.qty_received) || 0,
      unit: l.unit == null ? null : String(l.unit),
      sort_order: Number(l.sort_order) || 0,
      created_at: l.created_at == null ? undefined : String(l.created_at),
      updated_at: l.updated_at == null ? undefined : String(l.updated_at),
      bl_line_total_ht: (() => {
        if (l.bl_line_total_ht == null || l.bl_line_total_ht === "") return null;
        const n = Number(l.bl_line_total_ht);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      bl_unit_price_stock_ht: (() => {
        if (l.bl_unit_price_stock_ht == null || l.bl_unit_price_stock_ht === "") return null;
        const n = Number(l.bl_unit_price_stock_ht);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      manual_unit_price_stock_ht: (() => {
        if (l.manual_unit_price_stock_ht == null || l.manual_unit_price_stock_ht === "") return null;
        const n = Number(l.manual_unit_price_stock_ht);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      supplier_invoice_extracted_line_id:
        l.supplier_invoice_extracted_line_id == null || l.supplier_invoice_extracted_line_id === ""
          ? null
          : String(l.supplier_invoice_extracted_line_id),
      received_temperature_celsius: (() => {
        if (l.received_temperature_celsius == null || l.received_temperature_celsius === "") return null;
        const n = Number(l.received_temperature_celsius);
        return Number.isFinite(n) ? n : null;
      })(),
      lot_number:
        l.lot_number == null || String(l.lot_number).trim() === ""
          ? null
          : String(l.lot_number).trim(),
      expiry_date: (() => {
        if (l.expiry_date == null || l.expiry_date === "") return null;
        const s = String(l.expiry_date);
        return s.length >= 10 ? s.slice(0, 10) : s;
      })(),
      reception_line_verified_at:
        l.reception_line_verified_at == null || l.reception_line_verified_at === ""
          ? null
          : String(l.reception_line_verified_at),
      purchase_to_stock_ratio: ratio,
      stock_unit: inv?.unit ?? null,
      inventory_items: inv ? { name: inv.name } : null,
    };
  }) as (DeliveryNoteLine & {
    inventory_items: { name: string } | null;
  })[];

  const lineIds = lines.map((row) => row.id);
  const photosByLine = new Map<string, ReceptionTraceabilityPhoto[]>();
  if (lineIds.length > 0) {
    const { data: photoRows, error: photosErr } = await supabaseServer
      .from("reception_traceability_photos")
      .select("id, delivery_note_line_id, storage_path, element_type, created_at")
      .in("delivery_note_line_id", lineIds)
      .order("created_at", { ascending: true });
    if (photosErr) return { data: null, error: new Error(photosErr.message) };
    for (const p of photoRows ?? []) {
      const pr = p as {
        id: string;
        delivery_note_line_id: string;
        storage_path: string;
        element_type: string;
        created_at: string;
      };
      const photo: ReceptionTraceabilityPhoto = {
        id: pr.id,
        delivery_note_line_id: pr.delivery_note_line_id,
        storage_path: pr.storage_path,
        file_url: getDeliveryNoteFileUrl(pr.storage_path),
        element_type: pr.element_type,
        created_at: pr.created_at,
      };
      const list = photosByLine.get(pr.delivery_note_line_id) ?? [];
      list.push(photo);
      photosByLine.set(pr.delivery_note_line_id, list);
    }
  }

  const linesWithPhotos = lines.map((row) => ({
    ...row,
    traceability_photos: photosByLine.get(row.id) ?? [],
  })) as (DeliveryNoteLine & {
    inventory_items: { name: string } | null;
    traceability_photos: ReceptionTraceabilityPhoto[];
  })[];

  return {
    data: {
      ...(note as DeliveryNote),
      lines: linesWithPhotos,
    },
    error: null,
  };
}

/** Registre des photos de traçabilité (filtres optionnels). */
export async function getReceptionTraceabilityRegister(
  restaurantId: string,
  opts?: {
    fromDate?: string;
    toDate?: string;
    elementType?: string;
    lotSearch?: string;
  }
): Promise<{ data: ReceptionTraceabilityRegisterRow[]; error: Error | null }> {
  let q = supabaseServer
    .from("reception_traceability_photos")
    .select(
      `
      id,
      delivery_note_id,
      delivery_note_line_id,
      storage_path,
      element_type,
      created_at,
      delivery_notes ( delivery_date, number, supplier_id, suppliers ( name ) ),
      delivery_note_lines ( label, lot_number, expiry_date, inventory_items ( name ) )
    `
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (opts?.fromDate?.trim()) {
    q = q.gte("created_at", `${opts.fromDate.trim()}T00:00:00.000Z`);
  }
  if (opts?.toDate?.trim()) {
    q = q.lte("created_at", `${opts.toDate.trim()}T23:59:59.999Z`);
  }
  if (opts?.elementType && opts.elementType !== "all" && opts.elementType.trim() !== "") {
    q = q.eq("element_type", opts.elementType.trim());
  }

  const { data: rows, error } = await q;
  if (error) return { data: [], error: new Error(error.message) };

  type NestedName = { name?: string } | { name?: string }[] | null;
  const unwrapName = (n: NestedName): string | null => {
    if (n == null) return null;
    const o = Array.isArray(n) ? n[0] : n;
    return o && typeof (o as { name?: string }).name === "string"
      ? String((o as { name: string }).name)
      : null;
  };

  const out: ReceptionTraceabilityRegisterRow[] = [];
  const lotNeedle = opts?.lotSearch?.trim().toLowerCase() ?? "";

  for (const raw of rows ?? []) {
    const r = raw as Record<string, unknown>;
    const dn = r.delivery_notes as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
    const dno = Array.isArray(dn) ? dn[0] : dn;
    const dnl = r.delivery_note_lines as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
    const dnlo = Array.isArray(dnl) ? dnl[0] : dnl;

    const suppliersRaw = dno?.suppliers as NestedName;
    const invRaw = dnlo?.inventory_items as NestedName;

    const lot_number =
      dnlo?.lot_number == null || String(dnlo.lot_number).trim() === ""
        ? null
        : String(dnlo.lot_number).trim();
    if (lotNeedle && !(lot_number ?? "").toLowerCase().includes(lotNeedle)) {
      continue;
    }

    const expiry_raw = dnlo?.expiry_date;
    const expiry_date =
      expiry_raw == null || expiry_raw === ""
        ? null
        : String(expiry_raw).length >= 10
          ? String(expiry_raw).slice(0, 10)
          : String(expiry_raw);

    const storage_path = String(r.storage_path ?? "");
    out.push({
      id: String(r.id),
      created_at: String(r.created_at ?? ""),
      storage_path,
      file_url: getDeliveryNoteFileUrl(storage_path),
      element_type: String(r.element_type ?? "other"),
      delivery_note_id: String(r.delivery_note_id ?? ""),
      delivery_date:
        dno?.delivery_date == null || dno.delivery_date === ""
          ? null
          : String(dno.delivery_date).slice(0, 10),
      bl_number:
        dno?.number == null || dno.number === "" ? null : String(dno.number),
      supplier_name: unwrapName(suppliersRaw),
      line_label: dnlo?.label != null ? String(dnlo.label) : "—",
      lot_number,
      expiry_date,
      product_name: unwrapName(invRaw),
    });
  }

  return { data: out, error: null };
}

/** Retourne la réception existante pour cette commande fournisseur (n'importe quel statut), s'il en existe une. */
export async function getDeliveryNoteByPurchaseOrderId(
  purchaseOrderId: string
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await supabaseServer
    .from("delivery_notes")
    .select("id, status")
    .eq("purchase_order_id", purchaseOrderId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: String((data as { id: string }).id), status: String((data as { status: string }).status) };
}

/** Retourne pour chaque purchase_order_id la réception existante (une par PO, statut draft/validated/received). */
export async function getDeliveryNotesByPurchaseOrderIds(
  purchaseOrderIds: string[]
): Promise<Record<string, { id: string; status: string }>> {
  if (purchaseOrderIds.length === 0) return {};
  const { data, error } = await supabaseServer
    .from("delivery_notes")
    .select("id, purchase_order_id, status")
    .in("purchase_order_id", purchaseOrderIds);
  if (error) return {};
  const out: Record<string, { id: string; status: string }> = {};
  for (const row of data ?? []) {
    const poId = (row as { purchase_order_id: string | null }).purchase_order_id;
    if (poId && !out[poId]) {
      out[poId] = {
        id: String((row as { id: string }).id),
        status: String((row as { status: string }).status),
      };
    }
  }
  return out;
}

/** Crée un delivery_note brouillon à partir d'une commande fournisseur. Refuse si une réception existe déjà pour cette PO. */
export async function createDeliveryNoteFromPurchaseOrder(
  purchaseOrderId: string
): Promise<{ data: DeliveryNoteWithLines | null; error: Error | null }> {
  if (!purchaseOrderId || purchaseOrderId === "undefined") {
    return { data: null, error: new Error("purchase_order_id invalide (undefined).") };
  }

  const existing = await getDeliveryNoteByPurchaseOrderId(purchaseOrderId);
  if (existing) {
    return { data: null, error: new Error("Une réception existe déjà pour cette commande fournisseur.") };
  }

  const { data: po, error: poErr } = await supabaseServer
    .from("purchase_orders")
    .select("*")
    .eq("id", purchaseOrderId)
    .single();
  if (poErr || !po) {
    return {
      data: null,
      error: new Error(`purchase_order introuvable (${purchaseOrderId}).`),
    };
  }

  const restaurantId = (po as PurchaseOrder).restaurant_id ?? null;
  const supplierId = (po as PurchaseOrder).supplier_id ?? null;
  if (!restaurantId || !supplierId) {
    return { data: null, error: new Error("Commande fournisseur invalide (restaurant ou fournisseur manquant).") };
  }

  const { data: lines, error: linesErr } = await supabaseServer
    .from("purchase_order_lines")
    .select(
      "id, inventory_item_id, ordered_qty_purchase_unit, purchase_unit, purchase_to_stock_ratio, supplier_sku_snapshot, item_name_snapshot"
    )
    .eq("purchase_order_id", purchaseOrderId)
    .order("created_at", { ascending: true });
  if (linesErr) return { data: null, error: new Error(linesErr.message) };
  if (!lines || lines.length === 0) {
    return { data: null, error: new Error("Aucune ligne trouvée pour cette commande fournisseur.") };
  }

  const now = new Date().toISOString();
  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .insert({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      purchase_order_id: purchaseOrderId ?? null,
      source: "from_purchase_order",
      status: "draft",
      updated_at: now,
    })
    .select("id, restaurant_id, supplier_id, purchase_order_id, status, created_at, updated_at")
    .single();
  if (noteErr || !note) return { data: null, error: noteErr ? new Error(noteErr.message) : null };
  const noteId = (note as DeliveryNote).id ?? null;
  if (!noteId) return { data: null, error: new Error("Impossible de créer la réception (id manquant).") };

  const rows = (lines ?? []).map((l: Record<string, unknown>, index: number) => ({
    delivery_note_id: noteId,
    purchase_order_line_id: (l.id as string | null | undefined) ?? null,
    inventory_item_id: (l.inventory_item_id as string | null | undefined) ?? null,
    label: (l.item_name_snapshot as string | null | undefined) ?? "Ligne",
    qty_ordered: Number(l.ordered_qty_purchase_unit) || 0,
    qty_delivered: Number(l.ordered_qty_purchase_unit) || 0,
    qty_received:
      (Number(l.ordered_qty_purchase_unit) || 0) *
      (l.purchase_to_stock_ratio != null ? Number(l.purchase_to_stock_ratio) : 1),
    unit: (l.purchase_unit as string | null | undefined) ?? null,
    sort_order: index,
  }));

  if (rows.length > 0) {
    const { error: insErr } = await supabaseServer.from("delivery_note_lines").insert(rows);
    if (insErr) return { data: null, error: new Error(insErr.message) };
  }

  // Recharger avec les lignes complètes
  return getDeliveryNoteWithLines(noteId);
}

/** Recopie les lignes d'une purchase_order dans un delivery_note existant. */
export async function populateDeliveryNoteLinesFromPurchaseOrder(
  deliveryNoteId: string,
  purchaseOrderId: string
): Promise<{ error: Error | null }> {
  const { data: lines, error: linesErr } = await supabaseServer
    .from("purchase_order_lines")
    .select(
      "id, inventory_item_id, ordered_qty_purchase_unit, purchase_unit, purchase_to_stock_ratio, supplier_sku_snapshot, item_name_snapshot"
    )
    .eq("purchase_order_id", purchaseOrderId)
    .order("created_at", { ascending: true });
  if (linesErr) return { error: new Error(linesErr.message) };

  const rows = (lines ?? []).map((l: Record<string, unknown>, index: number) => ({
    delivery_note_id: deliveryNoteId,
    purchase_order_line_id: (l.id as string | null | undefined) ?? null,
    inventory_item_id: (l.inventory_item_id as string | null | undefined) ?? null,
    label: (l.item_name_snapshot as string | null | undefined) ?? "Ligne",
    qty_ordered: Number(l.ordered_qty_purchase_unit) || 0,
    qty_delivered: Number(l.ordered_qty_purchase_unit) || 0,
    qty_received:
      (Number(l.ordered_qty_purchase_unit) || 0) *
      (l.purchase_to_stock_ratio != null ? Number(l.purchase_to_stock_ratio) : 1),
    unit: (l.purchase_unit as string | null | undefined) ?? null,
    sort_order: index,
  }));

  if (rows.length > 0) {
    const { error: insErr } = await supabaseServer.from("delivery_note_lines").insert(rows);
    if (insErr) return { error: new Error(insErr.message) };
  }

  return { error: null };
}

/**
 * Crée un delivery_note à partir d'un upload de fichier BL.
 * Signature compatible avec app/suppliers/actions.ts.
 * Stocke l’URL publique du fichier (file_url) pour affichage dans l’historique et /receiving/[id].
 */
export async function createDeliveryNote(params: {
  restaurantId: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  filePath: string;
  fileName: string;
}): Promise<{ data: DeliveryNote | null; error: Error | null }> {
  const fileUrl = getDeliveryNoteFileUrl(params.filePath);
  return createDeliveryNoteFromUpload({
    restaurantId: params.restaurantId,
    supplierId: params.supplierId,
    purchaseOrderId: params.purchaseOrderId ?? null,
    filePath: params.filePath,
    fileName: params.fileName,
    fileUrl,
  });
}

// --- Factures fournisseur (supplier_invoices) et rapprochement ---

export { SUPPLIER_INVOICES_BUCKET };

export function getSupplierInvoiceFileUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  const { data } = supabaseServer.storage.from(SUPPLIER_INVOICES_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function createSupplierInvoice(params: {
  restaurantId: string;
  supplierId: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  filePath: string;
  fileName: string;
}): Promise<{ data: SupplierInvoice | null; error: Error | null }> {
  const fileUrl = getSupplierInvoiceFileUrl(params.filePath);
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("supplier_invoices")
    .insert({
      restaurant_id: params.restaurantId,
      supplier_id: params.supplierId,
      invoice_number: params.invoiceNumber ?? null,
      invoice_date: params.invoiceDate ?? null,
      file_path: params.filePath,
      file_name: params.fileName,
      file_url: fileUrl,
      status: "draft",
      updated_at: now,
    })
    .select("id, restaurant_id, supplier_id, invoice_number, invoice_date, file_path, file_name, file_url, amount_ht, amount_ttc, status, created_at, updated_at")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as SupplierInvoice, error: null };
}

export async function getSupplierInvoicesBySupplier(
  supplierId: string
): Promise<{ data: SupplierInvoice[] | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("supplier_invoices")
    .select("id, restaurant_id, supplier_id, invoice_number, invoice_date, file_path, file_name, file_url, amount_ht, amount_ttc, status, created_at, updated_at")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? []) as SupplierInvoice[], error: null };
}

export async function updateSupplierInvoice(
  invoiceId: string,
  restaurantId: string,
  params: {
    invoice_number?: string | null;
    invoice_date?: string | null;
    amount_ht?: number | null;
    amount_ttc?: number | null;
  }
): Promise<{ data: SupplierInvoice | null; error: Error | null }> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.invoice_number !== undefined) payload.invoice_number = params.invoice_number;
  if (params.invoice_date !== undefined) payload.invoice_date = params.invoice_date;
  if (params.amount_ht !== undefined) payload.amount_ht = params.amount_ht;
  if (params.amount_ttc !== undefined) payload.amount_ttc = params.amount_ttc;

  const { data, error } = await supabaseServer
    .from("supplier_invoices")
    .update(payload)
    .eq("id", invoiceId)
    .eq("restaurant_id", restaurantId)
    .select("id, restaurant_id, supplier_id, invoice_number, invoice_date, file_path, file_name, file_url, amount_ht, amount_ttc, status, created_at, updated_at")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as SupplierInvoice, error: null };
}

export type DeliveryNoteSummary = {
  id: string;
  created_at: string | null;
  status: string;
  lines_count: number;
  /** Nombre de lignes avec produit lié (inventory_item_id non null). */
  lines_with_product: number;
  /** Nombre de lignes sans produit lié (inventory_item_id null). */
  lines_without_product: number;
};

/** Résumé de contrôle V1 : état des réceptions liées à la facture. */
export type InvoiceControlSummary = {
  linked_receptions_count: number;
  total_lines: number;
  lines_with_product: number;
  lines_without_product: number;
  /** "none" = aucune réception liée, "review" = au moins une ligne sans produit, "ready" = prêt à vérifier. */
  control_state: "none" | "review" | "ready";
};

export type SupplierInvoiceWithDeliveryNotes = SupplierInvoice & {
  delivery_notes: DeliveryNoteSummary[];
  control_summary: InvoiceControlSummary;
  /** Vue parse de analysis_result_json pour l’affichage (null si pas d’analyse). */
  analysis_view: SupplierInvoiceAnalysisView | null;
  /** Rapprochement V1 : sommes, écarts montants, libellés approximatifs vs réceptions. */
  invoice_reconciliation: InvoiceReconciliationSummary;
};

const SUPPLIER_INVOICE_DETAIL_SELECT =
  "id, restaurant_id, supplier_id, invoice_number, invoice_date, file_path, file_name, file_url, amount_ht, amount_ttc, status, created_at, updated_at, analysis_result_json, analysis_status, analysis_error, analysis_version";

function mapDbExtractedLineToAnalysisLine(row: {
  label: string;
  quantity: unknown;
  unit: unknown;
  unit_price: unknown;
  line_total: unknown;
}): SupplierInvoiceAnalysisLine {
  return {
    label: row.label,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: row.unit == null ? null : String(row.unit),
    unit_price: row.unit_price == null ? null : Number(row.unit_price),
    line_total: row.line_total == null ? null : Number(row.line_total),
  };
}

/** Remplace les lignes extraites SQL pour une facture (sync après analyse ou backfill JSON). */
export async function replaceSupplierInvoiceExtractedLines(
  invoiceId: string,
  lines: SupplierInvoiceAnalysisLine[]
): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabaseServer
    .from("supplier_invoice_extracted_lines")
    .delete()
    .eq("supplier_invoice_id", invoiceId);
  if (delErr) return { error: new Error(delErr.message) };
  if (lines.length === 0) return { error: null };
  const rows = lines.map((l, i) => ({
    supplier_invoice_id: invoiceId,
    sort_order: i,
    label: (l.label?.trim() || "—").slice(0, 2000),
    quantity: l.quantity,
    unit: l.unit,
    unit_price: l.unit_price,
    line_total: l.line_total,
  }));
  const { error: insErr } = await supabaseServer.from("supplier_invoice_extracted_lines").insert(rows);
  return { error: insErr ? new Error(insErr.message) : null };
}

export async function getSupplierInvoiceWithDeliveryNotes(
  id: string
): Promise<{ data: SupplierInvoiceWithDeliveryNotes | null; error: Error | null }> {
  const { data: inv, error: invErr } = await supabaseServer
    .from("supplier_invoices")
    .select(SUPPLIER_INVOICE_DETAIL_SELECT)
    .eq("id", id)
    .single();
  if (invErr || !inv) return { data: null, error: invErr ? new Error(invErr.message) : null };

  let invRow = inv as SupplierInvoice;
  const parsedForPatch = parseSupplierInvoiceAnalysis(invRow.analysis_result_json);
  const patch =
    parsedForPatch &&
    buildMetadataPatchFromAnalysis(
      {
        invoice_number: invRow.invoice_number,
        invoice_date: invRow.invoice_date,
        amount_ht: invRow.amount_ht,
        amount_ttc: invRow.amount_ttc,
      },
      parsedForPatch
    );
  if (patch) {
    const { data: updated, error: upErr } = await supabaseServer
      .from("supplier_invoices")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(SUPPLIER_INVOICE_DETAIL_SELECT)
      .single();
    if (!upErr && updated) invRow = updated as SupplierInvoice;
  }

  const { data: extractedRows, error: extErr } = await supabaseServer
    .from("supplier_invoice_extracted_lines")
    .select("label, quantity, unit, unit_price, line_total, sort_order")
    .eq("supplier_invoice_id", id)
    .order("sort_order", { ascending: true });
  if (extErr) return { data: null, error: new Error(extErr.message) };

  let dbLines = (extractedRows ?? []) as {
    label: string;
    quantity: unknown;
    unit: unknown;
    unit_price: unknown;
    line_total: unknown;
  }[];

  const parsedFromJson = parseSupplierInvoiceAnalysis(invRow.analysis_result_json);
  if (dbLines.length === 0 && parsedFromJson && parsedFromJson.lines.length > 0) {
    const { error: backfillErr } = await replaceSupplierInvoiceExtractedLines(id, parsedFromJson.lines);
    if (!backfillErr) {
      const { data: again } = await supabaseServer
        .from("supplier_invoice_extracted_lines")
        .select("label, quantity, unit, unit_price, line_total, sort_order")
        .eq("supplier_invoice_id", id)
        .order("sort_order", { ascending: true });
      dbLines = (again ?? []) as typeof dbLines;
    }
  }

  const linesForView =
    dbLines.length > 0
      ? dbLines.map(mapDbExtractedLineToAnalysisLine)
      : (parsedFromJson?.lines ?? []);

  const mergedAnalysisView: SupplierInvoiceAnalysisView | null =
    parsedFromJson != null || linesForView.length > 0
      ? {
          invoice_number: parsedFromJson?.invoice_number ?? null,
          invoice_date: parsedFromJson?.invoice_date ?? null,
          amount_ht: parsedFromJson?.amount_ht ?? null,
          amount_ttc: parsedFromJson?.amount_ttc ?? null,
          lines: linesForView,
          raw_text: parsedFromJson?.raw_text ?? null,
        }
      : null;

  const { data: pivotRows } = await supabaseServer
    .from("supplier_invoice_delivery_notes")
    .select("delivery_note_id")
    .eq("supplier_invoice_id", id);
  const noteIds = (pivotRows ?? []).map((r: { delivery_note_id: string }) => r.delivery_note_id);
  let deliveryNotes: DeliveryNoteSummary[] = [];
  let control_summary: InvoiceControlSummary = {
    linked_receptions_count: 0,
    total_lines: 0,
    lines_with_product: 0,
    lines_without_product: 0,
    control_state: "none",
  };
  type ReceptionLineRef = { label: string | null; itemName: string | null };
  let receptionLineRefs: ReceptionLineRef[] = [];

  if (noteIds.length > 0) {
    const { data: notes } = await supabaseServer
      .from("delivery_notes")
      .select("id, created_at, status")
      .in("id", noteIds);
    const { data: lines } = await supabaseServer
      .from("delivery_note_lines")
      .select("delivery_note_id, inventory_item_id, label, inventory_items(name)")
      .in("delivery_note_id", noteIds);

    const byNote: Record<
      string,
      { lines_count: number; with_product: number; without_product: number }
    > = {};
    for (const nid of noteIds) {
      byNote[nid] = { lines_count: 0, with_product: 0, without_product: 0 };
    }
    for (const row of lines ?? []) {
      const r = row as {
        delivery_note_id: string;
        inventory_item_id: string | null;
        label?: string | null;
        inventory_items?: { name?: string } | { name?: string }[] | null;
      };
      const nid = r.delivery_note_id;
      const hasProduct = r.inventory_item_id != null;
      if (byNote[nid]) {
        byNote[nid].lines_count += 1;
        if (hasProduct) byNote[nid].with_product += 1;
        else byNote[nid].without_product += 1;
      }
      const invRaw = Array.isArray(r.inventory_items) ? r.inventory_items[0] : r.inventory_items;
      const itemName =
        invRaw && typeof (invRaw as { name?: string }).name === "string"
          ? (invRaw as { name: string }).name
          : null;
      receptionLineRefs.push({
        label: r.label == null ? null : String(r.label),
        itemName,
      });
    }

    deliveryNotes = (notes ?? []).map((n: { id: string; created_at: string | null; status: string }) => {
      const agg = byNote[n.id] ?? { lines_count: 0, with_product: 0, without_product: 0 };
      return {
        id: n.id,
        created_at: n.created_at,
        status: n.status,
        lines_count: agg.lines_count,
        lines_with_product: agg.with_product,
        lines_without_product: agg.without_product,
      };
    });

    const total_lines = deliveryNotes.reduce((s, dn) => s + dn.lines_count, 0);
    const lines_with_product = deliveryNotes.reduce((s, dn) => s + dn.lines_with_product, 0);
    const lines_without_product = deliveryNotes.reduce((s, dn) => s + dn.lines_without_product, 0);
    control_summary = {
      linked_receptions_count: noteIds.length,
      total_lines,
      lines_with_product,
      lines_without_product,
      control_state:
        total_lines === 0
          ? "ready"
          : lines_without_product > 0
            ? "review"
            : "ready",
    };
  }

  const invoice_reconciliation = buildInvoiceReconciliation({
    extractedLines: linesForView,
    receptionLines: receptionLineRefs,
    amount_ht: invRow.amount_ht,
    amount_ttc: invRow.amount_ttc,
  });

  return {
    data: {
      ...invRow,
      delivery_notes: deliveryNotes,
      control_summary,
      analysis_view: mergedAnalysisView,
      invoice_reconciliation,
    },
    error: null,
  };
}

/** Réceptions du fournisseur qui ne sont pas encore liées à une facture (V1 : une réception = au plus une facture). */
export async function getDeliveryNotesBySupplierNotLinked(
  supplierId: string,
  restaurantId: string
): Promise<{ data: DeliveryNote[] | null; error: Error | null }> {
  const { data: linked } = await supabaseServer
    .from("supplier_invoice_delivery_notes")
    .select("delivery_note_id");
  const linkedIds = new Set((linked ?? []).map((r: { delivery_note_id: string }) => r.delivery_note_id));
  const { data: notes, error } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, supplier_id, status, created_at, updated_at, purchase_order_id, number, delivery_date, source, file_path, file_name, file_url")
    .eq("supplier_id", supplierId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: new Error(error.message) };
  const filtered = (notes ?? []).filter((n: { id: string }) => !linkedIds.has(n.id));
  return { data: filtered as DeliveryNote[], error: null };
}

export async function linkDeliveryNotesToSupplierInvoice(
  invoiceId: string,
  deliveryNoteIds: string[],
  restaurantId: string
): Promise<{ error: Error | null }> {
  if (deliveryNoteIds.length === 0) return { error: null };
  const { data: invoice, error: invErr } = await supabaseServer
    .from("supplier_invoices")
    .select("id, restaurant_id, supplier_id")
    .eq("id", invoiceId)
    .single();
  if (invErr || !invoice) return { error: new Error("Facture introuvable.") };
  if ((invoice as { restaurant_id: string }).restaurant_id !== restaurantId) {
    return { error: new Error("Cette facture n'appartient pas à ce restaurant.") };
  }
  const invSupplierId = (invoice as { supplier_id: string }).supplier_id;

  for (const dnId of deliveryNoteIds) {
    const { data: dn } = await supabaseServer
      .from("delivery_notes")
      .select("id, restaurant_id, supplier_id")
      .eq("id", dnId)
      .single();
    if (!dn) return { error: new Error("Une des réceptions est introuvable.") };
    if ((dn as { restaurant_id: string }).restaurant_id !== restaurantId) {
      return { error: new Error("Une réception appartient à un autre restaurant.") };
    }
    if ((dn as { supplier_id: string }).supplier_id !== invSupplierId) {
      return { error: new Error("Une réception appartient à un autre fournisseur.") }
    }
    const { data: existing } = await supabaseServer
      .from("supplier_invoice_delivery_notes")
      .select("id, supplier_invoice_id")
      .eq("delivery_note_id", dnId)
      .maybeSingle();
    if (existing) {
      const otherInv = (existing as { supplier_invoice_id: string }).supplier_invoice_id;
      if (otherInv !== invoiceId) {
        return { error: new Error("Une réception est déjà liée à une autre facture (V1 : une réception = une facture).") };
      }
      continue;
    }
    const { error: insertErr } = await supabaseServer
      .from("supplier_invoice_delivery_notes")
      .insert({ supplier_invoice_id: invoiceId, delivery_note_id: dnId });
    if (insertErr) return { error: new Error(insertErr.message) };
  }

  const { error: updateErr } = await supabaseServer
    .from("supplier_invoices")
    .update({ status: "linked", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (updateErr) return { error: new Error(updateErr.message) };
  return { error: null };
}
