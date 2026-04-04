/**
 * Couche 1 — mouvements de stock (journal).
 * Couche 3 — les entrées et sorties déclenchent lots / allocations FIFO via `fifo.ts`.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  allocateFifoForOutboundMovement,
  createLotForSourceMovement,
  weightedAverageUnitCostForRemaining,
} from "@/lib/stock/fifo";

/** Ligne minimale pour journaliser une consommation / revert (sans dépendre du module recipes). */
export type StockConsumptionLine = {
  inventory_item_id: string;
  qty: number;
  unit?: string | null;
};

const MOVEMENT_QTY_EPS = 1e-9;

export const STOCK_MOVEMENT_TYPES = ["purchase", "consumption", "adjustment", "inventory_count"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export type StockMovementRow = {
  id: string;
  restaurant_id: string;
  inventory_item_id: string;
  quantity: number;
  unit: string;
  movement_type: StockMovementType;
  unit_cost: number | null;
  occurred_at: string;
  delivery_note_id: string | null;
  delivery_note_line_id: string | null;
  supplier_invoice_id: string | null;
  reference_label: string | null;
  created_at: string;
  created_by: string | null;
};

type ReceptionLineInput = {
  lineId: string;
  inventoryItemId: string;
  quantity: number;
};

/**
 * Récupère la facture fournisseur liée à une réception (pivot), s’il y en a une.
 */
export async function getSupplierInvoiceIdForDeliveryNote(
  deliveryNoteId: string
): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("supplier_invoice_delivery_notes")
    .select("supplier_invoice_id")
    .eq("delivery_note_id", deliveryNoteId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { supplier_invoice_id: string }).supplier_invoice_id ?? null;
}

/**
 * Insère les mouvements d’achat liés à une réception validée (une ligne BL = un mouvement).
 * Quantité > 0 uniquement. unit = unité de stock de l’article.
 */
export async function insertPurchaseMovementsFromReception(params: {
  restaurantId: string;
  deliveryNoteId: string;
  supplierInvoiceId: string | null;
  lines: ReceptionLineInput[];
  /** Unités par inventory_item_id */
  unitsByItemId: Record<string, string>;
  occurredAt: string;
  createdBy: string | null;
  referenceLabel?: string | null;
  /** Coût unitaire HT (€ / unité de stock), par id de ligne BL — issu facture rapprochée. */
  unitCostByLineId?: Record<string, number>;
}): Promise<{ error: Error | null }> {
  const costMap = params.unitCostByLineId ?? {};
  const rows = params.lines
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const unit = params.unitsByItemId[l.inventoryItemId]?.trim() || "unit";
      const rawCost = costMap[l.lineId];
      const unitCost =
        rawCost != null && Number.isFinite(rawCost) && rawCost > 0 ? rawCost : null;
      return {
        restaurant_id: params.restaurantId,
        inventory_item_id: l.inventoryItemId,
        quantity: l.quantity,
        unit,
        movement_type: "purchase" as const,
        unit_cost: unitCost,
        occurred_at: params.occurredAt,
        delivery_note_id: params.deliveryNoteId,
        delivery_note_line_id: l.lineId,
        supplier_invoice_id: params.supplierInvoiceId,
        reference_label: params.referenceLabel ?? null,
        created_by: params.createdBy,
      };
    });

  if (rows.length === 0) return { error: null };

  const { data: inserted, error } = await supabaseServer
    .from("stock_movements")
    .insert(rows)
    .select("id, inventory_item_id, quantity, occurred_at, unit_cost");
  if (error) return { error: new Error(error.message) };

  for (const row of inserted ?? []) {
    const r = row as {
      id: string;
      inventory_item_id: string;
      quantity: string | number;
      occurred_at: string;
      unit_cost: string | number | null;
    };
    const qty = Number(r.quantity);
    if (qty <= MOVEMENT_QTY_EPS) continue;
    const uc = r.unit_cost != null && Number.isFinite(Number(r.unit_cost)) ? Number(r.unit_cost) : null;
    const lotErr = await createLotForSourceMovement({
      restaurantId: params.restaurantId,
      inventoryItemId: r.inventory_item_id,
      sourceStockMovementId: r.id,
      qtyInitial: qty,
      unitCost: uc,
      openedAt: r.occurred_at,
    });
    if (lotErr.error) return lotErr;
  }

  return { error: null };
}

/** Parse qty depuis la vue (numeric → number). */
function parseQtyCalculated(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Couche 2 — stock théorique par article (vue `inventory_stock_from_movements`).
 */
export async function getCalculatedStockByItemForRestaurant(
  restaurantId: string
): Promise<{ data: Map<string, number>; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("inventory_stock_from_movements")
    .select("inventory_item_id, qty_calculated")
    .eq("restaurant_id", restaurantId);

  if (error) return { data: new Map(), error: new Error(error.message) };

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const r = row as { inventory_item_id: string; qty_calculated: string | number };
    map.set(r.inventory_item_id, parseQtyCalculated(r.qty_calculated));
  }
  return { data: map, error: null };
}

export async function getCalculatedStockForSingleItem(
  restaurantId: string,
  inventoryItemId: string
): Promise<{ qty: number; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("inventory_stock_from_movements")
    .select("qty_calculated")
    .eq("restaurant_id", restaurantId)
    .eq("inventory_item_id", inventoryItemId)
    .maybeSingle();

  if (error) return { qty: 0, error: new Error(error.message) };
  if (!data) return { qty: 0, error: null };
  return {
    qty: parseQtyCalculated((data as { qty_calculated: string | number }).qty_calculated),
    error: null,
  };
}

/**
 * Ajustement : delta par rapport au stock déjà calculé depuis les mouvements (correction / inventaire / annulation).
 * Positif → lot (CMP des lots ouverts) ; négatif → allocation FIFO.
 */
export async function insertAdjustmentMovement(params: {
  restaurantId: string;
  inventoryItemId: string;
  quantityDelta: number;
  unit: string;
  referenceLabel: string | null;
  createdBy: string | null;
  occurredAt?: string;
}): Promise<{ error: Error | null }> {
  if (Math.abs(params.quantityDelta) < MOVEMENT_QTY_EPS) return { error: null };
  const now = params.occurredAt ?? new Date().toISOString();
  const { data: mov, error } = await supabaseServer
    .from("stock_movements")
    .insert({
      restaurant_id: params.restaurantId,
      inventory_item_id: params.inventoryItemId,
      quantity: params.quantityDelta,
      unit: params.unit.trim() || "unit",
      movement_type: "adjustment",
      unit_cost: null,
      occurred_at: now,
      delivery_note_id: null,
      delivery_note_line_id: null,
      supplier_invoice_id: null,
      reference_label: params.referenceLabel,
      created_by: params.createdBy,
    })
    .select("id, quantity, occurred_at")
    .single();

  if (error) return { error: new Error(error.message) };
  if (!mov) return { error: new Error("Mouvement d’ajustement non créé.") };

  const id = (mov as { id: string }).id;
  const q = Number((mov as { quantity: string | number }).quantity);
  const occurredAt = String((mov as { occurred_at: string }).occurred_at);

  if (q > MOVEMENT_QTY_EPS) {
    const avg = await weightedAverageUnitCostForRemaining(params.restaurantId, params.inventoryItemId);
    return createLotForSourceMovement({
      restaurantId: params.restaurantId,
      inventoryItemId: params.inventoryItemId,
      sourceStockMovementId: id,
      qtyInitial: q,
      unitCost: avg,
      openedAt: occurredAt,
    });
  }

  return allocateFifoForOutboundMovement({
    outboundStockMovementId: id,
    restaurantId: params.restaurantId,
    inventoryItemId: params.inventoryItemId,
    quantityPositive: Math.abs(q),
  });
}

/** Consommation théorique (service) : quantités négatives. */
export async function insertConsumptionMovements(
  restaurantId: string,
  consumption: StockConsumptionLine[],
  referenceLabel: string | null,
  createdBy: string | null
): Promise<{ error: Error | null }> {
  const occurredAt = new Date().toISOString();
  const rows = consumption
    .filter((c) => c.qty > 0)
    .map((c) => ({
      restaurant_id: restaurantId,
      inventory_item_id: c.inventory_item_id,
      quantity: -c.qty,
      unit: (c.unit ?? "unit").trim() || "unit",
      movement_type: "consumption" as const,
      unit_cost: null,
      occurred_at: occurredAt,
      delivery_note_id: null,
      delivery_note_line_id: null,
      supplier_invoice_id: null,
      reference_label: referenceLabel,
      created_by: createdBy,
    }));
  if (rows.length === 0) return { error: null };
  const { data: inserted, error } = await supabaseServer.from("stock_movements").insert(rows).select(
    "id, inventory_item_id, quantity"
  );
  if (error) return { error: new Error(error.message) };

  for (const row of inserted ?? []) {
    const r = row as { id: string; inventory_item_id: string; quantity: string | number };
    const qtyAbs = Math.abs(Number(r.quantity));
    if (qtyAbs <= MOVEMENT_QTY_EPS) continue;
    const allocErr = await allocateFifoForOutboundMovement({
      outboundStockMovementId: r.id,
      restaurantId,
      inventoryItemId: r.inventory_item_id,
      quantityPositive: qtyAbs,
    });
    if (allocErr.error) return allocErr;
  }

  return { error: null };
}
