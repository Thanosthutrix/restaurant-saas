"use server";

import { revalidatePath } from "next/cache";
import { assertCategoryAssignable } from "@/app/categories/actions";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";
import { getInventoryItemComponents, getInventoryItems } from "@/lib/db";
import {
  getCalculatedStockForSingleItem,
  insertAdjustmentMovement,
} from "@/lib/stock/stockMovements";
import { assertNoInventoryCycle } from "@/lib/recipes/assertNoInventoryCycle";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { ALLOWED_STOCK_UNITS_HELP_FR, parseAllowedStockUnit } from "@/lib/constants";
import { roundMoney } from "@/lib/stock/purchasePriceHistory";
import { roundRecipeQty, stockUnitQtyScaleFactor } from "@/lib/units/stockUnitConversion";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function requireInventoryMutate(userId: string, restaurantId: string): Promise<ActionResult> {
  const g = await assertRestaurantAction(userId, restaurantId, "inventory.mutate");
  if (!g.ok) return { ok: false, error: g.error };
  return { ok: true };
}

const ITEM_TYPES = ["ingredient", "prep", "resale"] as const;

/** Met à jour recipe_status du parent (prep) : missing si 0 composant, draft sinon. */
async function syncPrepRecipeStatus(parentItemId: string, restaurantId: string): Promise<void> {
  const { data: comps } = await getInventoryItemComponents(parentItemId);
  const count = (comps ?? []).length;
  const recipe_status = count === 0 ? "missing" : "draft";
  await supabaseServer
    .from("inventory_items")
    .update({ recipe_status })
    .eq("id", parentItemId)
    .eq("restaurant_id", restaurantId);
}

/** Recettes où cet article est composant : met les quantités à l’échelle (ex. ml → l). */
async function scaleComponentRecipeQuantitiesForItemUnitChange(params: {
  restaurantId: string;
  inventoryItemId: string;
  factor: number;
}): Promise<{ error: string | null }> {
  const { restaurantId, inventoryItemId, factor } = params;

  const { data: iicRows, error: iicErr } = await supabaseServer
    .from("inventory_item_components")
    .select("id, qty")
    .eq("restaurant_id", restaurantId)
    .eq("component_item_id", inventoryItemId);

  if (iicErr) return { error: iicErr.message };

  for (const r of iicRows ?? []) {
    const id = (r as { id: string }).id;
    const q = Number((r as { qty: unknown }).qty);
    if (!Number.isFinite(q)) continue;
    const nq = roundRecipeQty(q * factor);
    if (nq <= 1e-9) {
      return {
        error:
          "Après changement d’unité, une quantité de recette (préparation) deviendrait nulle. Ajustez ou supprimez la ligne concernée, puis réessayez.",
      };
    }
    const { error } = await supabaseServer.from("inventory_item_components").update({ qty: nq }).eq("id", id);
    if (error) return { error: error.message };
  }

  const { data: dcRows, error: dcErr } = await supabaseServer
    .from("dish_components")
    .select("id, qty")
    .eq("restaurant_id", restaurantId)
    .eq("inventory_item_id", inventoryItemId);

  if (dcErr) return { error: dcErr.message };

  for (const r of dcRows ?? []) {
    const id = (r as { id: string }).id;
    const q = Number((r as { qty: unknown }).qty);
    if (!Number.isFinite(q)) continue;
    const nq = roundRecipeQty(q * factor);
    if (nq <= 1e-9) {
      return {
        error:
          "Après changement d’unité, une quantité de recette (plat) deviendrait nulle. Ajustez ou supprimez la ligne concernée, puis réessayez.",
      };
    }
    const { error } = await supabaseServer.from("dish_components").update({ qty: nq }).eq("id", id);
    if (error) return { error: error.message };
  }

  return { error: null };
}

export async function createInventoryItem(params: {
  restaurantId: string;
  name: string;
  unit: string;
  itemType: (typeof ITEM_TYPES)[number];
  currentStockQty?: number;
  minStockQty?: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const { restaurantId, name, unit, itemType, currentStockQty = 0, minStockQty } = params;
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Nom requis." };
  if (!unit.trim()) return { ok: false, error: "Unité requise." };
  const canonicalUnit = parseAllowedStockUnit(unit);
  if (!canonicalUnit) {
    return { ok: false, error: `Unité non autorisée. Utilisez : ${ALLOWED_STOCK_UNITS_HELP_FR}.` };
  }
  if (!ITEM_TYPES.includes(itemType)) return { ok: false, error: "Type invalide (ingredient, prep, resale)." };
  const qty = Number(currentStockQty);
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, error: "Stock actuel invalide (nombre ≥ 0)." };
  const minQty = minStockQty == null ? null : Number(minStockQty);
  if (minQty !== null && (!Number.isFinite(minQty) || minQty < 0)) return { ok: false, error: "Seuil minimum invalide (nombre ≥ 0 ou vide)." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const inv = await requireInventoryMutate(user.id, restaurantId);
  if (!inv.ok) return inv;

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .insert({
      restaurant_id: restaurantId,
      name: trimmedName,
      unit: canonicalUnit,
      item_type: itemType,
      current_stock_qty: qty,
      min_stock_qty: minQty,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Un composant avec ce nom existe déjà." };
    return { ok: false, error: error.message };
  }

  const newId = (data as { id: string }).id;
  if (qty > 0) {
    const adj = await insertAdjustmentMovement({
      restaurantId,
      inventoryItemId: newId,
      quantityDelta: qty,
      unit: canonicalUnit,
      referenceLabel: "Stock initial (création)",
      createdBy: user?.id ?? null,
    });
    if (adj.error) {
      await supabaseServer.from("inventory_items").delete().eq("id", newId).eq("restaurant_id", restaurantId);
      return { ok: false, error: adj.error.message };
    }
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/orders/suggestions", "page");
  revalidatePath("/dashboard", "page");
  return { ok: true, data: { id: newId } };
}

export async function updateInventoryItem(params: {
  itemId: string;
  restaurantId: string;
  name: string;
  unit: string;
  itemType: (typeof ITEM_TYPES)[number];
  currentStockQty: number;
  minStockQty?: number | null;
  supplierId?: string | null;
  supplierSku?: string | null;
  purchaseUnit?: string | null;
  unitsPerPurchase?: number | null;
  minOrderQuantity?: number | null;
  orderMultiple?: number | null;
  targetStockQty?: number | null;
  /** € HT / unité de stock ; null = effacer la référence. */
  referencePurchaseUnitCostHt?: number | null;
}): Promise<ActionResult> {
  const {
    itemId,
    restaurantId,
    name,
    unit,
    itemType,
    currentStockQty,
    minStockQty,
    supplierId,
    supplierSku,
    purchaseUnit,
    unitsPerPurchase,
    minOrderQuantity,
    orderMultiple,
    targetStockQty,
    referencePurchaseUnitCostHt,
  } = params;
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "Nom requis." };
  if (!unit.trim()) return { ok: false, error: "Unité requise." };
  const canonicalUnit = parseAllowedStockUnit(unit);
  if (!canonicalUnit) {
    return { ok: false, error: `Unité non autorisée. Utilisez : ${ALLOWED_STOCK_UNITS_HELP_FR}.` };
  }
  if (!ITEM_TYPES.includes(itemType)) return { ok: false, error: "Type invalide." };
  const qty = Number(currentStockQty);
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, error: "Stock actuel invalide (nombre ≥ 0)." };
  const minQty = minStockQty == null ? null : Number(minStockQty);
  if (minQty !== null && (!Number.isFinite(minQty) || minQty < 0)) return { ok: false, error: "Seuil minimum invalide (nombre ≥ 0 ou vide)." };
  if (referencePurchaseUnitCostHt !== undefined && referencePurchaseUnitCostHt !== null) {
    const r = Number(referencePurchaseUnitCostHt);
    if (!Number.isFinite(r) || r < 0) return { ok: false, error: "Prix d’achat de référence invalide (nombre ≥ 0 ou vide)." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const { data: current } = await supabaseServer
    .from("inventory_items")
    .select(
      "id, item_type, unit, reference_purchase_unit_cost_ht, min_stock_qty, target_stock_qty"
    )
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!current) return { ok: false, error: "Composant introuvable." };

  const cur = current as {
    item_type: string;
    unit: string;
    reference_purchase_unit_cost_ht: unknown;
    min_stock_qty: unknown;
    target_stock_qty: unknown;
  };

  const wasPrep = cur.item_type === "prep";
  const becomesNonPrep = itemType !== "prep";
  if (wasPrep && becomesNonPrep) {
    const { data: asParent } = await supabaseServer
      .from("inventory_item_components")
      .select("id")
      .eq("parent_item_id", itemId)
      .limit(1);
    if ((asParent ?? []).length > 0) {
      return {
        ok: false,
        error: "Impossible de passer en ingredient ou revente : ce composant est utilisé comme préparation (il a des composants). Supprimez-les d'abord.",
      };
    }
  }

  const oldCanon = parseAllowedStockUnit(String(cur.unit ?? ""));
  const unitScaleFactor =
    oldCanon != null && oldCanon !== canonicalUnit
      ? stockUnitQtyScaleFactor(oldCanon, canonicalUnit)
      : null;

  if (unitScaleFactor != null && unitScaleFactor !== 1) {
    const scaled = await scaleComponentRecipeQuantitiesForItemUnitChange({
      restaurantId,
      inventoryItemId: itemId,
      factor: unitScaleFactor,
    });
    if (scaled.error) return { ok: false, error: scaled.error };
  }

  const calc = await getCalculatedStockForSingleItem(restaurantId, itemId);
  let effectiveStockQty = qty;
  let skipAdjustmentForUnitChange = false;
  if (unitScaleFactor != null && unitScaleFactor !== 1 && !calc.error) {
    effectiveStockQty = roundRecipeQty(calc.qty * unitScaleFactor);
    skipAdjustmentForUnitChange = true;
  }

  if (!skipAdjustmentForUnitChange && !calc.error) {
    const delta = effectiveStockQty - calc.qty;
    if (Math.abs(delta) >= 1e-9) {
      const adj = await insertAdjustmentMovement({
        restaurantId,
        inventoryItemId: itemId,
        quantityDelta: delta,
        unit: canonicalUnit,
        referenceLabel: "Correction manuelle (fiche composant)",
        createdBy: user.id,
      });
      if (adj.error) return { ok: false, error: adj.error.message };
    }
  }

  let effectiveMinQty = minQty;
  if (unitScaleFactor != null && unitScaleFactor !== 1) {
    const oldM = cur.min_stock_qty;
    if (oldM != null && oldM !== "") {
      const m = Number(oldM);
      if (Number.isFinite(m) && m >= 0) {
        effectiveMinQty = roundRecipeQty(m * unitScaleFactor);
      }
    }
  }

  const update: Record<string, unknown> = {
    name: trimmedName,
    unit: canonicalUnit,
    item_type: itemType,
    current_stock_qty: effectiveStockQty,
    min_stock_qty: effectiveMinQty,
  };
  if (params.supplierId !== undefined) update.supplier_id = supplierId || null;
  if (params.supplierSku !== undefined) update.supplier_sku = supplierSku?.trim() || null;
  if (params.purchaseUnit !== undefined) update.purchase_unit = purchaseUnit?.trim() || null;
  if (params.unitsPerPurchase !== undefined) update.units_per_purchase = unitsPerPurchase ?? null;
  if (params.minOrderQuantity !== undefined) update.min_order_quantity = minOrderQuantity ?? null;
  if (params.orderMultiple !== undefined) update.order_multiple = orderMultiple ?? null;

  if (unitScaleFactor != null && unitScaleFactor !== 1) {
    const oldT = cur.target_stock_qty;
    if (oldT != null && oldT !== "") {
      const t = Number(oldT);
      if (Number.isFinite(t) && t >= 0) {
        update.target_stock_qty = roundRecipeQty(t * unitScaleFactor);
      }
    }
  } else if (params.targetStockQty !== undefined) {
    update.target_stock_qty = targetStockQty ?? null;
  }

  if (referencePurchaseUnitCostHt !== undefined) {
    if (referencePurchaseUnitCostHt === null) {
      update.reference_purchase_unit_cost_ht = null;
    } else if (unitScaleFactor != null && unitScaleFactor !== 1) {
      const prevRef = cur.reference_purchase_unit_cost_ht;
      const p = prevRef == null || prevRef === "" ? null : Number(prevRef);
      if (p != null && Number.isFinite(p) && p > 0) {
        update.reference_purchase_unit_cost_ht = roundMoney(p / unitScaleFactor);
      } else {
        const r = Number(referencePurchaseUnitCostHt);
        update.reference_purchase_unit_cost_ht = Number.isFinite(r) && r > 0 ? r : null;
      }
    } else {
      const r = Number(referencePurchaseUnitCostHt);
      update.reference_purchase_unit_cost_ht = Number.isFinite(r) && r > 0 ? r : null;
    }
  }

  const { error } = await supabaseServer
    .from("inventory_items")
    .update(update)
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Un composant avec ce nom existe déjà." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/inventory");
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/dishes/[id]", "page");
  revalidatePath("/orders/suggestions", "page");
  revalidatePath("/dashboard", "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}

export async function updateInventoryItemCategory(params: {
  itemId: string;
  restaurantId: string;
  categoryId: string | null;
}): Promise<ActionResult> {
  const { itemId, restaurantId, categoryId } = params;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const check = await assertCategoryAssignable(categoryId, restaurantId, "inventory");
  if (!check.ok) return { ok: false, error: check.error };

  const { error } = await supabaseServer
    .from("inventory_items")
    .update({ category_id: categoryId })
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/orders/suggestions", "page");
  return { ok: true };
}

export async function updateInventoryItemSupplier(params: {
  itemId: string;
  restaurantId: string;
  supplierId?: string | null;
  supplierSku?: string | null;
  purchaseUnit?: string | null;
  unitsPerPurchase?: number | null;
  minOrderQuantity?: number | null;
  orderMultiple?: number | null;
  targetStockQty?: number | null;
}): Promise<ActionResult> {
  const {
    itemId,
    restaurantId,
    supplierId,
    supplierSku,
    purchaseUnit,
    unitsPerPurchase,
    minOrderQuantity,
    orderMultiple,
    targetStockQty,
  } = params;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const { data: current } = await supabaseServer
    .from("inventory_items")
    .select("id")
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId)
    .single();
  if (!current) return { ok: false, error: "Composant introuvable." };

  const update: Record<string, unknown> = {};
  if (params.supplierId !== undefined) update.supplier_id = supplierId || null;
  if (params.supplierSku !== undefined) update.supplier_sku = supplierSku?.trim() || null;
  if (params.purchaseUnit !== undefined) update.purchase_unit = purchaseUnit?.trim() || null;
  if (params.unitsPerPurchase !== undefined) update.units_per_purchase = unitsPerPurchase ?? null;
  if (params.minOrderQuantity !== undefined) update.min_order_quantity = minOrderQuantity ?? null;
  if (params.orderMultiple !== undefined) update.order_multiple = orderMultiple ?? null;
  if (params.targetStockQty !== undefined) update.target_stock_qty = targetStockQty ?? null;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabaseServer
    .from("inventory_items")
    .update(update)
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/orders/suggestions", "page");
  return { ok: true };
}

export async function deleteInventoryItem(params: {
  itemId: string;
  restaurantId: string;
}): Promise<ActionResult> {
  const { itemId, restaurantId } = params;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const { data: itemRow, error: itemErr } = await supabaseServer
    .from("inventory_items")
    .select("id")
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (itemErr) return { ok: false, error: itemErr.message };
  if (!itemRow) return { ok: false, error: "Composant introuvable." };

  const [asParent, asComponent, asDishComp, pol, dnl, sil] = await Promise.all([
    supabaseServer.from("inventory_item_components").select("id").eq("parent_item_id", itemId).limit(1),
    supabaseServer.from("inventory_item_components").select("id").eq("component_item_id", itemId).limit(1),
    supabaseServer.from("dish_components").select("id").eq("inventory_item_id", itemId).limit(1),
    supabaseServer.from("purchase_order_lines").select("id").eq("inventory_item_id", itemId).limit(1),
    supabaseServer.from("delivery_note_lines").select("id").eq("inventory_item_id", itemId).limit(1),
    supabaseServer.from("supplier_invoice_lines").select("id").eq("inventory_item_id", itemId).limit(1),
  ]);

  for (const q of [asParent, asComponent, asDishComp, pol, dnl, sil]) {
    if (q.error) return { ok: false, error: q.error.message };
  }

  if ((asParent.data ?? []).length > 0) {
    return {
      ok: false,
      error:
        "Ce composant est une préparation qui a encore des sous-composants. Retirez-les d’abord dans la section composition.",
    };
  }
  if ((asComponent.data ?? []).length > 0) {
    return {
      ok: false,
      error: "Ce composant est utilisé dans une préparation. Retirez-le de la composition avant de le supprimer.",
    };
  }
  if ((asDishComp.data ?? []).length > 0) {
    return {
      ok: false,
      error: "Ce composant est utilisé dans un plat. Retirez-le de la recette du plat avant de le supprimer.",
    };
  }
  if ((pol.data ?? []).length > 0) {
    return {
      ok: false,
      error:
        "Ce composant figure sur au moins une commande fournisseur. Supprimez ou modifiez ces commandes avant de le retirer.",
    };
  }
  if ((dnl.data ?? []).length > 0) {
    return {
      ok: false,
      error:
        "Ce composant figure sur au moins un bon de livraison. L’historique d’achat doit être conservé ou modifié avant suppression.",
    };
  }
  if ((sil.data ?? []).length > 0) {
    return {
      ok: false,
      error:
        "Ce composant figure sur au moins une facture fournisseur. Il ne peut pas être supprimé tant que ces lignes existent.",
    };
  }

  const { data: lots, error: lotsErr } = await supabaseServer
    .from("inventory_stock_lots")
    .select("id")
    .eq("inventory_item_id", itemId)
    .eq("restaurant_id", restaurantId);
  if (lotsErr) return { ok: false, error: lotsErr.message };
  const lotIds = (lots ?? []).map((r: { id: string }) => r.id);

  const { data: movements, error: movErr } = await supabaseServer
    .from("stock_movements")
    .select("id")
    .eq("inventory_item_id", itemId)
    .eq("restaurant_id", restaurantId);
  if (movErr) return { ok: false, error: movErr.message };
  const movIds = (movements ?? []).map((r: { id: string }) => r.id);

  if (lotIds.length > 0) {
    const { error: a1 } = await supabaseServer.from("stock_lot_allocations").delete().in("lot_id", lotIds);
    if (a1) return { ok: false, error: a1.message };
  }
  if (movIds.length > 0) {
    const { error: a2 } = await supabaseServer
      .from("stock_lot_allocations")
      .delete()
      .in("outbound_stock_movement_id", movIds);
    if (a2) return { ok: false, error: a2.message };
  }
  if (lotIds.length > 0) {
    const { error: dl } = await supabaseServer.from("inventory_stock_lots").delete().in("id", lotIds);
    if (dl) return { ok: false, error: dl.message };
  }
  if (movIds.length > 0) {
    const { error: dm } = await supabaseServer.from("stock_movements").delete().in("id", movIds);
    if (dm) return { ok: false, error: dm.message };
  }

  const { error } = await supabaseServer
    .from("inventory_items")
    .delete()
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/dishes/[id]", "page");
  revalidatePath("/orders", "page");
  revalidatePath("/orders/suggestions", "page");
  revalidatePath("/dashboard", "page");
  revalidatePath("/margins", "page");
  return { ok: true };
}

export async function addInventoryItemComponent(params: {
  restaurantId: string;
  parentItemId: string;
  componentItemId: string;
  qty: number;
}): Promise<ActionResult> {
  const { restaurantId, parentItemId, componentItemId, qty } = params;
  if (qty <= 0) return { ok: false, error: "La quantité doit être strictement positive." };
  if (parentItemId === componentItemId) return { ok: false, error: "Un composant ne peut pas être son propre parent." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const [parentRes, componentRes] = await Promise.all([
    supabaseServer.from("inventory_items").select("id, restaurant_id, item_type").eq("id", parentItemId).maybeSingle(),
    supabaseServer.from("inventory_items").select("id, restaurant_id").eq("id", componentItemId).maybeSingle(),
  ]);

  const parent = parentRes.data as { id: string; restaurant_id: string; item_type: string } | null;
  const component = componentRes.data as { id: string; restaurant_id: string } | null;

  if (parentRes.error) return { ok: false, error: parentRes.error.message };
  if (componentRes.error) return { ok: false, error: componentRes.error.message };
  if (!parent) return { ok: false, error: "Composant parent introuvable." };
  if (!component) return { ok: false, error: "Composant à ajouter introuvable." };
  if (parent.restaurant_id !== restaurantId || component.restaurant_id !== restaurantId) {
    return { ok: false, error: "Les composants doivent appartenir au même restaurant." };
  }
  if (parent.item_type !== "prep") {
    return { ok: false, error: "Seules les préparations (type prep) peuvent avoir des composants. Le parent sélectionné n'est pas une préparation." };
  }

  try {
    await assertNoInventoryCycle({ restaurantId, parentItemId, componentItemId });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Boucle de composition détectée." };
  }

  const { error } = await supabaseServer.from("inventory_item_components").insert({
    restaurant_id: restaurantId,
    parent_item_id: parentItemId,
    component_item_id: componentItemId,
    qty,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ce composant est déjà dans la préparation." };
    return { ok: false, error: error.message };
  }
  await syncPrepRecipeStatus(parentItemId, restaurantId);
  revalidatePath("/inventory");
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/dishes/[id]", "page");
  return { ok: true };
}

export async function updateInventoryItemComponent(params: {
  id: string;
  restaurantId: string;
  qty: number;
}): Promise<ActionResult> {
  const { id, restaurantId, qty } = params;
  if (qty <= 0) return { ok: false, error: "La quantité doit être strictement positive." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const { data: row, error: fetchError } = await supabaseServer
    .from("inventory_item_components")
    .select("id, parent_item_id, component_item_id, restaurant_id")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!row) return { ok: false, error: "Ligne de composition introuvable." };

  const parentRes = await supabaseServer
    .from("inventory_items")
    .select("id, restaurant_id, item_type")
    .eq("id", (row as { parent_item_id: string }).parent_item_id)
    .maybeSingle();

  const parent = parentRes.data as { id: string; restaurant_id: string; item_type: string } | null;
  if (parentRes.error) return { ok: false, error: parentRes.error.message };
  if (!parent) return { ok: false, error: "Composant parent introuvable." };
  if (parent.restaurant_id !== restaurantId) {
    return { ok: false, error: "Le parent de cette ligne n'appartient pas au même restaurant." };
  }
  if (parent.item_type !== "prep") {
    return { ok: false, error: "Seules les lignes dont le parent est une préparation (type prep) peuvent être modifiées." };
  }

  const { error } = await supabaseServer
    .from("inventory_item_components")
    .update({ qty })
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  const rowData = row as { parent_item_id: string };
  await syncPrepRecipeStatus(rowData.parent_item_id, restaurantId);
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/dishes/[id]", "page");
  return { ok: true };
}

export async function deleteInventoryItemComponent(params: {
  id: string;
  restaurantId: string;
}): Promise<ActionResult> {
  const { id, restaurantId } = params;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const { data: row, error: fetchError } = await supabaseServer
    .from("inventory_item_components")
    .select("id, parent_item_id, restaurant_id")
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!row) return { ok: false, error: "Ligne de composition introuvable." };

  const parentRes = await supabaseServer
    .from("inventory_items")
    .select("id, restaurant_id, item_type")
    .eq("id", (row as { parent_item_id: string }).parent_item_id)
    .maybeSingle();

  const parent = parentRes.data as { restaurant_id: string; item_type: string } | null;
  if (parentRes.error) return { ok: false, error: parentRes.error.message };
  if (!parent) return { ok: false, error: "Composant parent introuvable." };
  if (parent.restaurant_id !== restaurantId) {
    return { ok: false, error: "Le parent de cette ligne n'appartient pas au même restaurant." };
  }
  if (parent.item_type !== "prep") {
    return { ok: false, error: "Seules les lignes dont le parent est une préparation (type prep) peuvent être supprimées." };
  }

  const { error } = await supabaseServer
    .from("inventory_item_components")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  const rowData = row as { parent_item_id: string };
  await syncPrepRecipeStatus(rowData.parent_item_id, restaurantId);
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/dishes/[id]", "page");
  return { ok: true };
}

export type ApplyPrepRecipeComponent = {
  name: string;
  unit: string;
  itemType: "ingredient" | "prep" | "resale";
  qty: number;
};

/** Applique un brouillon de composition à une préparation : find-or-create inventory items, crée inventory_item_components, met recipe_status = draft. Refuse si la prep a déjà des composants. */
export async function applySuggestedRecipeToPrep(params: {
  restaurantId: string;
  inventoryItemId: string;
  components: ApplyPrepRecipeComponent[];
}): Promise<ActionResult> {
  const { restaurantId, inventoryItemId, components } = params;

  if (!components || components.length === 0) {
    return { ok: false, error: "Le brouillon doit contenir au moins un composant." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const { data: item, error: itemError } = await supabaseServer
    .from("inventory_items")
    .select("id, restaurant_id, item_type")
    .eq("id", inventoryItemId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (itemError) return { ok: false, error: itemError.message };
  if (!item) return { ok: false, error: "Composant introuvable." };

  const row = item as { item_type: string };
  if (row.item_type !== "prep") {
    return { ok: false, error: "Seules les préparations (type prep) peuvent avoir une composition." };
  }

  const { data: existingComps } = await getInventoryItemComponents(inventoryItemId);
  if ((existingComps ?? []).length > 0) {
    return { ok: false, error: "Cette préparation a déjà des composants. Supprimez-les d'abord pour appliquer un brouillon." };
  }

  const { data: existingItems } = await getInventoryItems(restaurantId);
  const items = existingItems ?? [];
  const nameToId = new Map<string, string>();
  for (const i of items) {
    nameToId.set(normalizeInventoryItemName(i.name), i.id);
  }

  for (const comp of components) {
    const qty = Number(comp.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: `La quantité pour "${comp.name}" doit être strictement positive.` };
    }
    const key = normalizeInventoryItemName(comp.name);
    let componentId = nameToId.get(key);
    if (!componentId) {
      const itemType = comp.itemType ?? "ingredient";
      const newUnit = parseAllowedStockUnit(comp.unit || "unit");
      if (!newUnit) {
        return {
          ok: false,
          error: `Unité non autorisée pour « ${comp.name} ». Utilisez : ${ALLOWED_STOCK_UNITS_HELP_FR}.`,
        };
      }
      const { data: created, error: createErr } = await supabaseServer
        .from("inventory_items")
        .insert({
          restaurant_id: restaurantId,
          name: comp.name.trim(),
          unit: newUnit,
          item_type: itemType,
        })
        .select("id")
        .single();
      if (createErr) return { ok: false, error: `Impossible de créer le composant "${comp.name}": ${createErr.message}.` };
      componentId = (created as { id: string }).id;
      nameToId.set(key, componentId);
    }

    try {
      await assertNoInventoryCycle({ restaurantId, parentItemId: inventoryItemId, componentItemId: componentId });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Boucle de composition détectée." };
    }

    const { error: insertErr } = await supabaseServer.from("inventory_item_components").insert({
      restaurant_id: restaurantId,
      parent_item_id: inventoryItemId,
      component_item_id: componentId,
      qty,
    });
    if (insertErr) return { ok: false, error: insertErr.message };
  }

  await supabaseServer
    .from("inventory_items")
    .update({ recipe_status: "draft" })
    .eq("id", inventoryItemId)
    .eq("restaurant_id", restaurantId);

  revalidatePath("/inventory");
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/dishes/[id]", "page");
  return { ok: true };
}

/** Passe la recette de la préparation en validée. La prep doit avoir au moins un composant. */
export async function validatePrepRecipe(params: {
  restaurantId: string;
  inventoryItemId: string;
}): Promise<ActionResult> {
  const { restaurantId, inventoryItemId } = params;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const invGate = await requireInventoryMutate(user.id, restaurantId);
  if (!invGate.ok) return invGate;

  const { data: item, error: itemError } = await supabaseServer
    .from("inventory_items")
    .select("id, restaurant_id, item_type")
    .eq("id", inventoryItemId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (itemError) return { ok: false, error: itemError.message };
  if (!item) return { ok: false, error: "Composant introuvable." };
  if ((item as { item_type: string }).item_type !== "prep") {
    return { ok: false, error: "Seules les préparations peuvent être validées." };
  }

  const { data: comps } = await getInventoryItemComponents(inventoryItemId);
  if ((comps ?? []).length === 0) return { ok: false, error: "Impossible de valider : la préparation n'a aucun composant." };

  const { error } = await supabaseServer
    .from("inventory_items")
    .update({ recipe_status: "validated" })
    .eq("id", inventoryItemId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory/[id]", "page");
  revalidatePath("/dishes/[id]", "page");
  return { ok: true };
}
