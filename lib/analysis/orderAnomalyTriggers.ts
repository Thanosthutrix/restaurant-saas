/**
 * Détection d'anomalies lors de l'ajustement d'une commande fournisseur vs stock théorique.
 */

import { supabaseServer } from "@/lib/supabaseServer";

export type OrderAdjustmentAnomalyType =
  | "decrease_while_theo_zero"
  | "increase_while_theo_positive";

export type OrderAdjustmentAnomaly = {
  anomalyType: OrderAdjustmentAnomalyType;
  inventoryItemId: string;
  itemName: string;
  suggestedQty: number;
  adjustedQty: number;
  theoreticalStockQty: number;
};

export const ORDER_ANOMALY_EXPLANATIONS: { code: string; label: string }[] = [
  { code: "delivery_tomorrow", label: "Livraison demain / commande déjà passée" },
  { code: "stock_error", label: "Erreur de stock / inventaire récent" },
  { code: "event_service", label: "Événement ou service exceptionnel prévu" },
  { code: "quality_issue", label: "Problème qualité / produit à éviter" },
  { code: "menu_change", label: "Changement carte / plat retiré" },
  { code: "other", label: "Autre raison" },
];

export function detectOrderAdjustmentAnomaly(params: {
  previousQty: number;
  newQty: number;
  theoreticalStockQty: number;
}): OrderAdjustmentAnomalyType | null {
  const prev = params.previousQty;
  const next = Math.max(0, params.newQty);
  const stock = Math.max(0, params.theoreticalStockQty);

  if (next < prev && stock <= MOVEMENT_EPS) {
    return "decrease_while_theo_zero";
  }
  if (next > prev && stock > MOVEMENT_EPS) {
    return "increase_while_theo_positive";
  }
  return null;
}

const MOVEMENT_EPS = 1e-6;

export async function saveOrderAnomalyResponse(params: {
  restaurantId: string;
  orderDraftId?: string | null;
  orderDraftLineId?: string | null;
  inventoryItemId: string;
  anomalyType: OrderAdjustmentAnomalyType;
  suggestedQty: number;
  adjustedQty: number;
  theoreticalStockQty: number;
  explanationCode: string;
  explanationNote?: string | null;
  respondedBy?: string | null;
  source?: "order_draft" | "suggestion";
}): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer.from("supplier_order_anomaly_responses").insert({
    restaurant_id: params.restaurantId,
    order_draft_id: params.orderDraftId ?? null,
    order_draft_line_id: params.orderDraftLineId ?? null,
    inventory_item_id: params.inventoryItemId,
    anomaly_type: params.anomalyType,
    suggested_qty: params.suggestedQty,
    adjusted_qty: params.adjustedQty,
    theoretical_stock_qty: params.theoreticalStockQty,
    explanation_code: params.explanationCode,
    explanation_note: params.explanationNote?.trim() || null,
    responded_by: params.respondedBy ?? null,
    source: params.source ?? "order_draft",
  });

  return { error: error ? new Error(error.message) : null };
}
