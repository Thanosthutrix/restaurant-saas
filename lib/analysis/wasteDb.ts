/**
 * Saisie des pertes (WasteLog) avec sortie stock optionnelle.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  allocateFifoForOutboundMovement,
  weightedAverageUnitCostForRemaining,
} from "@/lib/stock/fifo";
import type { WasteReason, WasteType } from "@/lib/analysis/types";

const MOVEMENT_QTY_EPS = 1e-9;

export type WasteLogRow = {
  id: string;
  restaurant_id: string;
  service_id: string | null;
  inventory_item_id: string | null;
  dish_id: string | null;
  waste_type: WasteType;
  reason: WasteReason;
  quantity: number;
  unit: string;
  estimated_cost_ht: number | null;
  notes: string | null;
  stock_movement_id: string | null;
  logged_at: string;
  logged_by: string | null;
};

export async function createWasteLog(params: {
  restaurantId: string;
  serviceId?: string | null;
  inventoryItemId?: string | null;
  dishId?: string | null;
  wasteType: WasteType;
  reason: WasteReason;
  quantity: number;
  unit: string;
  notes?: string | null;
  loggedBy?: string | null;
  applyStock?: boolean;
}): Promise<{ data: WasteLogRow | null; error: Error | null }> {
  if (params.quantity <= 0) {
    return { data: null, error: new Error("La quantité doit être positive.") };
  }

  let stockMovementId: string | null = null;
  let estimatedCostHt: number | null = null;

  if (params.applyStock !== false && params.inventoryItemId) {
    const stockResult = await insertWasteStockMovement({
      restaurantId: params.restaurantId,
      inventoryItemId: params.inventoryItemId,
      quantity: params.quantity,
      unit: params.unit,
      wasteType: params.wasteType,
      reason: params.reason,
      createdBy: params.loggedBy ?? null,
    });
    if (stockResult.error) return { data: null, error: stockResult.error };
    stockMovementId = stockResult.movementId;
    estimatedCostHt = stockResult.estimatedCostHt;
  }

  const { data, error } = await supabaseServer
    .from("waste_logs")
    .insert({
      restaurant_id: params.restaurantId,
      service_id: params.serviceId ?? null,
      inventory_item_id: params.inventoryItemId ?? null,
      dish_id: params.dishId ?? null,
      waste_type: params.wasteType,
      reason: params.reason,
      quantity: params.quantity,
      unit: params.unit.trim() || "unit",
      estimated_cost_ht: estimatedCostHt,
      notes: params.notes?.trim() || null,
      stock_movement_id: stockMovementId,
      logged_by: params.loggedBy ?? null,
    })
    .select("*")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as WasteLogRow, error: null };
}

async function insertWasteStockMovement(params: {
  restaurantId: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  wasteType: WasteType;
  reason: WasteReason;
  createdBy: string | null;
}): Promise<{ movementId: string | null; estimatedCostHt: number | null; error: Error | null }> {
  const referenceLabel = `Perte ${params.wasteType} (${params.reason})`;
  const now = new Date().toISOString();

  const { data: mov, error } = await supabaseServer
    .from("stock_movements")
    .insert({
      restaurant_id: params.restaurantId,
      inventory_item_id: params.inventoryItemId,
      quantity: -params.quantity,
      unit: params.unit.trim() || "unit",
      movement_type: "waste",
      unit_cost: null,
      occurred_at: now,
      reference_label: referenceLabel,
      created_by: params.createdBy,
    })
    .select("id, quantity")
    .single();

  if (error) return { movementId: null, estimatedCostHt: null, error: new Error(error.message) };
  if (!mov) return { movementId: null, estimatedCostHt: null, error: new Error("Mouvement perte non créé.") };

  const movementId = String(mov.id);
  const qtyAbs = Math.abs(Number(mov.quantity));

  const fifoResult = await allocateFifoForOutboundMovement({
    outboundStockMovementId: movementId,
    restaurantId: params.restaurantId,
    inventoryItemId: params.inventoryItemId,
    quantityPositive: qtyAbs,
  });
  if (fifoResult.error) return { movementId: null, estimatedCostHt: null, error: fifoResult.error };

  const avg = await weightedAverageUnitCostForRemaining(params.restaurantId, params.inventoryItemId);
  const estimatedCostHt =
    avg != null && Number.isFinite(avg) ? Math.round(qtyAbs * avg * 100) / 100 : null;

  return { movementId, estimatedCostHt, error: null };
}

export async function listRecentWasteLogs(
  restaurantId: string,
  limit = 50
): Promise<{ data: WasteLogRow[]; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("waste_logs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("logged_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as WasteLogRow[], error: null };
}
