"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getInventoryItem,
  deletePurchaseOrder,
  createDeliveryNoteFromPurchaseOrder,
  getPurchaseOrder,
  markPurchaseOrderSent,
} from "@/lib/db";
import { createPurchaseOrder } from "@/lib/db";
import { sendPurchaseOrderToSupplierEmail } from "@/lib/messaging/purchaseOrderEmails";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function ensureReceptionDraftForPurchaseOrder(
  orderId: string
): Promise<ActionResult<{ deliveryNoteId: string }>> {
  const { data, error } = await createDeliveryNoteFromPurchaseOrder(orderId);
  if (data?.id) {
    return { ok: true, data: { deliveryNoteId: data.id } };
  }
  if (error?.message.includes("existe déjà")) {
    return { ok: true };
  }
  return { ok: false, error: error?.message ?? "Impossible de préparer la réception." };
}

/**
 * Génère une commande fournisseur à partir d'une suggestion.
 * Crée la purchase_order et les lignes avec snapshots.
 *
 * Règle métier (module achats) : la génération d'une commande ne modifie pas le stock.
 * Seule une réception validée (ex. via BL validé) peut augmenter le stock.
 */
export async function createPurchaseOrderFromSuggestion(params: {
  restaurantId: string;
  supplierId: string;
  generatedMessage: string | null;
  expectedDeliveryDate?: string | null;
  lines: { inventory_item_id: string; ordered_qty_purchase_unit: number }[];
}): Promise<ActionResult<{ orderId: string }>> {
  const { restaurantId, supplierId, generatedMessage, expectedDeliveryDate, lines } = params;
  if (lines.length === 0) return { ok: false, error: "Aucune ligne à commander." };

  const linesWithSnapshots: Array<{
    inventory_item_id: string;
    ordered_qty_purchase_unit: number;
    purchase_unit: string;
    purchase_to_stock_ratio: number;
    supplier_sku_snapshot: string | null;
    item_name_snapshot: string;
  }> = [];

  for (const line of lines) {
    const { data: item, error } = await getInventoryItem(line.inventory_item_id);
    if (error || !item || item.restaurant_id !== restaurantId) {
      return { ok: false, error: `Composant introuvable : ${line.inventory_item_id}` };
    }
    const ratio = item.units_per_purchase != null ? Number(item.units_per_purchase) : null;
    if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) {
      return { ok: false, error: `Configuration achat manquante pour ${item.name}. Renseignez la conversion (1 unité achetée = combien de stock).` };
    }
    linesWithSnapshots.push({
      inventory_item_id: line.inventory_item_id,
      ordered_qty_purchase_unit: line.ordered_qty_purchase_unit,
      purchase_unit: (item.purchase_unit ?? "unité").trim() || "unité",
      purchase_to_stock_ratio: ratio,
      supplier_sku_snapshot: item.supplier_sku?.trim() || null,
      item_name_snapshot: item.name,
    });
  }

  const { data: order, error } = await createPurchaseOrder({
    restaurantId,
    supplierId,
    generatedMessage: generatedMessage || null,
    expectedDeliveryDate: expectedDeliveryDate ?? null,
    lines: linesWithSnapshots,
  });

  if (error || !order) return { ok: false, error: error?.message ?? "Erreur à la création de la commande." };
  revalidatePath("/orders");
  revalidatePath("/orders/[id]", "page");
  revalidatePath("/orders/suggestions", "page");
  revalidatePath("/suppliers/[id]", "page");
  return { ok: true, data: { orderId: order.id } };
}

/**
 * Supprime une commande fournisseur (et ses lignes en cascade).
 * Vérifie que la commande appartient au restaurant courant.
 */
export async function deletePurchaseOrderAction(
  orderId: string,
  restaurantId: string
): Promise<ActionResult> {
  const { error } = await deletePurchaseOrder(orderId, restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  revalidatePath("/orders/[id]", "page");
  revalidatePath("/suppliers/[id]", "page");
  redirect("/orders");
}

export async function createDeliveryNoteFromPurchaseOrderAction(
  purchaseOrderId: string,
  restaurantId: string
): Promise<ActionResult<{ deliveryNoteId: string }>> {
  const { data, error } = await createDeliveryNoteFromPurchaseOrder(purchaseOrderId);
  if (error || !data) return { ok: false, error: error?.message ?? "Erreur lors de la création de la réception." };
  if (data.restaurant_id !== restaurantId) return { ok: false, error: "Cette commande n'appartient pas à ce restaurant." };
  revalidatePath("/suppliers/[id]", "page");
  revalidatePath("/orders/[id]", "page");
  revalidatePath("/receiving/[id]", "page");
  return { ok: true, data: { deliveryNoteId: data.id } };
}

export async function sendPurchaseOrderEmailAction(params: {
  orderId: string;
  restaurantId: string;
}): Promise<ActionResult<{ alreadySent: boolean; deliveryNoteId?: string }>> {
  const result = await sendPurchaseOrderToSupplierEmail(params);
  if (!result.ok) return { ok: false, error: result.error };
  const reception = await ensureReceptionDraftForPurchaseOrder(params.orderId);
  if (!reception.ok) return reception;
  revalidatePath("/orders");
  revalidatePath(`/orders/${params.orderId}`);
  revalidatePath("/livraison");
  if (reception.data?.deliveryNoteId) {
    revalidatePath(`/receiving/${reception.data.deliveryNoteId}`);
  }
  return { ok: true, data: { alreadySent: result.alreadySent, deliveryNoteId: reception.data?.deliveryNoteId } };
}

export async function markPurchaseOrderSentManualAction(params: {
  orderId: string;
  restaurantId: string;
  channel: "whatsapp" | "sms" | "phone" | "portal";
}): Promise<ActionResult> {
  const orderRes = await getPurchaseOrder(params.orderId);
  if (orderRes.error) return { ok: false, error: orderRes.error.message };
  const order = orderRes.data;
  if (!order || order.restaurant_id !== params.restaurantId) {
    return { ok: false, error: "Commande fournisseur introuvable." };
  }
  const mark = await markPurchaseOrderSent({
    orderId: params.orderId,
    restaurantId: params.restaurantId,
    channel: params.channel,
    toEmail: null,
  });
  if (mark.error) return { ok: false, error: mark.error.message };
  const reception = await ensureReceptionDraftForPurchaseOrder(params.orderId);
  if (!reception.ok) return reception;
  revalidatePath("/orders");
  revalidatePath(`/orders/${params.orderId}`);
  revalidatePath("/livraison");
  if (reception.data?.deliveryNoteId) {
    revalidatePath(`/receiving/${reception.data.deliveryNoteId}`);
  }
  return { ok: true };
}
