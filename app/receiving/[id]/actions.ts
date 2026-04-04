"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";
import { getDeliveryNoteFileUrl } from "@/lib/db";
import { resolveReceptionLineUnitCosts } from "@/lib/stock/receptionUnitCost";
import {
  getSupplierInvoiceIdForDeliveryNote,
  insertPurchaseMovementsFromReception,
} from "@/lib/stock/stockMovements";

async function assertExtractedLineAllowedForDeliveryNote(
  deliveryNoteId: string,
  extractedLineId: string | null | undefined
): Promise<void> {
  if (!extractedLineId) return;
  const linkedInvoiceId = await getSupplierInvoiceIdForDeliveryNote(deliveryNoteId);
  if (!linkedInvoiceId) {
    throw new Error(
      "Liez d’abord une facture à cette réception pour sélectionner une ligne facture."
    );
  }
  const { data: row, error } = await supabaseServer
    .from("supplier_invoice_extracted_lines")
    .select("supplier_invoice_id")
    .eq("id", extractedLineId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || (row as { supplier_invoice_id: string }).supplier_invoice_id !== linkedInvoiceId) {
    throw new Error("La ligne facture ne correspond pas à la facture liée à cette réception.");
  }
}

export async function attachBlToDeliveryNoteAction(
  deliveryNoteId: string,
  restaurantId: string,
  filePath: string,
  fileName: string
): Promise<void> {
  const { data: note } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, status")
    .eq("id", deliveryNoteId)
    .single();
  if (!note) throw new Error("Réception introuvable.");
  if (note.restaurant_id !== restaurantId) throw new Error("Réception non liée à ce restaurant.");
  if (note.status === "validated") {
    throw new Error("Cette réception est validée. Impossible d'ajouter ou modifier le fichier BL.");
  }
  const fileUrl = getDeliveryNoteFileUrl(filePath);
  const { error } = await supabaseServer
    .from("delivery_notes")
    .update({
      file_path: filePath,
      file_name: fileName,
      file_url: fileUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliveryNoteId)
    .eq("restaurant_id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/receiving/${deliveryNoteId}`);
}

export async function addDeliveryNoteLineAction(
  deliveryNoteId: string,
  params: {
    label: string;
    inventory_item_id?: string | null;
    qty_delivered: number;
    qty_received: number;
    unit?: string | null;
    sort_order: number;
    bl_line_total_ht?: number | null;
    bl_unit_price_stock_ht?: number | null;
    manual_unit_price_stock_ht?: number | null;
    supplier_invoice_extracted_line_id?: string | null;
  }
): Promise<void> {
  const { data: note } = await supabaseServer
    .from("delivery_notes")
    .select("id, status")
    .eq("id", deliveryNoteId)
    .single();
  if (!note) throw new Error("Réception introuvable.");
  if (note.status === "validated") {
    throw new Error("Cette réception a déjà été validée. Impossible d'ajouter des lignes.");
  }
  await assertExtractedLineAllowedForDeliveryNote(
    deliveryNoteId,
    params.supplier_invoice_extracted_line_id ?? null
  );
  const label = (params.label ?? "").trim() || "Ligne";
  const { error } = await supabaseServer.from("delivery_note_lines").insert({
    delivery_note_id: deliveryNoteId,
    purchase_order_line_id: null,
    inventory_item_id: params.inventory_item_id ?? null,
    label,
    qty_ordered: 0,
    qty_delivered: params.qty_delivered ?? 0,
    qty_received: params.qty_received ?? 0,
    unit: params.unit ?? null,
    sort_order: params.sort_order ?? 0,
    bl_line_total_ht: params.bl_line_total_ht ?? null,
    bl_unit_price_stock_ht: params.bl_unit_price_stock_ht ?? null,
    manual_unit_price_stock_ht: params.manual_unit_price_stock_ht ?? null,
    supplier_invoice_extracted_line_id: params.supplier_invoice_extracted_line_id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/receiving/${deliveryNoteId}`);
}

export async function updateDeliveryNoteLinesAction(
  deliveryNoteId: string,
  lines: {
    id: string;
    qty_delivered: number;
    qty_received: number;
    bl_line_total_ht?: number | null;
    bl_unit_price_stock_ht?: number | null;
    manual_unit_price_stock_ht?: number | null;
    supplier_invoice_extracted_line_id?: string | null;
  }[]
): Promise<void> {
  if (lines.length === 0) return;
  const { data: note } = await supabaseServer
    .from("delivery_notes")
    .select("status")
    .eq("id", deliveryNoteId)
    .single();
  if (note?.status === "validated") {
    throw new Error("Cette réception a déjà été validée. Les quantités ne peuvent plus être modifiées.");
  }
  for (const line of lines) {
    await assertExtractedLineAllowedForDeliveryNote(
      deliveryNoteId,
      line.supplier_invoice_extracted_line_id ?? null
    );
    await supabaseServer
      .from("delivery_note_lines")
      .update({
        qty_delivered: line.qty_delivered,
        qty_received: line.qty_received,
        bl_line_total_ht: line.bl_line_total_ht ?? null,
        bl_unit_price_stock_ht: line.bl_unit_price_stock_ht ?? null,
        manual_unit_price_stock_ht: line.manual_unit_price_stock_ht ?? null,
        supplier_invoice_extracted_line_id: line.supplier_invoice_extracted_line_id ?? null,
      })
      .eq("id", line.id)
      .eq("delivery_note_id", deliveryNoteId);
  }
  revalidatePath(`/receiving/${deliveryNoteId}`);
}

export async function validateReceptionAction(deliveryNoteId: string, restaurantId: string): Promise<void> {
  const { data: note, error } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, status")
    .eq("id", deliveryNoteId)
    .single();
  if (error || !note) throw new Error(error?.message ?? "Réception introuvable.");
  if (note.restaurant_id !== restaurantId) throw new Error("Réception non liée à ce restaurant.");
  if (note.status === "validated" || note.status === "received") {
    throw new Error("Cette réception a déjà été validée.");
  }

  const { data: lines, error: linesErr } = await supabaseServer
    .from("delivery_note_lines")
    .select(
      "id, inventory_item_id, qty_received, label, purchase_order_line_id, bl_line_total_ht, bl_unit_price_stock_ht, manual_unit_price_stock_ht, supplier_invoice_extracted_line_id"
    )
    .eq("delivery_note_id", deliveryNoteId);
  if (linesErr) throw new Error(linesErr.message);
  if (!lines || lines.length === 0) {
    throw new Error("Impossible de valider une réception sans aucune ligne. Ajoutez au moins une ligne.");
  }

  const linesWithProduct = lines.filter((l) => l.inventory_item_id);
  const itemIds = [...new Set(linesWithProduct.map((l) => l.inventory_item_id as string))];
  const unitsByItemId: Record<string, string> = {};
  if (itemIds.length > 0) {
    const { data: items, error: itemsErr } = await supabaseServer
      .from("inventory_items")
      .select("id, unit")
      .in("id", itemIds)
      .eq("restaurant_id", restaurantId);
    if (itemsErr) throw new Error(itemsErr.message);
    for (const row of items ?? []) {
      unitsByItemId[(row as { id: string }).id] = String((row as { unit: string }).unit);
    }
  }

  const supplierInvoiceId = await getSupplierInvoiceIdForDeliveryNote(deliveryNoteId);
  const user = await getCurrentUser();
  const occurredAt = new Date().toISOString();

  const unitCostByLineId = await resolveReceptionLineUnitCosts({
    restaurantId,
    supplierInvoiceId,
    lines: linesWithProduct.map((l) => {
      const row = l as {
        id: string;
        label?: string | null;
        inventory_item_id: string;
        qty_received: unknown;
        purchase_order_line_id?: string | null;
        bl_line_total_ht?: unknown;
        bl_unit_price_stock_ht?: unknown;
        manual_unit_price_stock_ht?: unknown;
        supplier_invoice_extracted_line_id?: string | null;
      };
      const manual =
        row.manual_unit_price_stock_ht != null ? Number(row.manual_unit_price_stock_ht) : null;
      return {
        id: row.id,
        label: row.label ?? null,
        inventory_item_id: row.inventory_item_id,
        qty_received: Number(row.qty_received) || 0,
        purchase_order_line_id: row.purchase_order_line_id ?? null,
        bl_line_total_ht:
          row.bl_line_total_ht != null ? Number(row.bl_line_total_ht) : null,
        bl_unit_price_stock_ht:
          row.bl_unit_price_stock_ht != null ? Number(row.bl_unit_price_stock_ht) : null,
        manual_unit_price_stock_ht:
          manual != null && Number.isFinite(manual) && manual > 0 ? manual : null,
        supplier_invoice_extracted_line_id: row.supplier_invoice_extracted_line_id ?? null,
      };
    }),
  });

  const movementLines = linesWithProduct.map((l) => ({
    lineId: l.id as string,
    inventoryItemId: l.inventory_item_id as string,
    quantity: Number(l.qty_received) || 0,
  }));

  const { error: movErr } = await insertPurchaseMovementsFromReception({
    restaurantId: restaurantId,
    deliveryNoteId,
    supplierInvoiceId,
    lines: movementLines,
    unitsByItemId,
    occurredAt,
    createdBy: user?.id ?? null,
    referenceLabel: "Réception validée (BL)",
    unitCostByLineId,
  });
  if (movErr) throw new Error(movErr.message);

  // Appliquer les entrées en stock (uniquement les lignes avec inventory_item_id)
  for (const line of lines) {
    if (!line.inventory_item_id) continue;
    const qty = Number(line.qty_received) || 0;
    if (qty <= 0) continue;
    const { data: row, error: fetchErr } = await supabaseServer
      .from("inventory_items")
      .select("current_stock_qty")
      .eq("id", line.inventory_item_id)
      .eq("restaurant_id", restaurantId)
      .single();
    if (fetchErr || !row) continue;
    const current = Number(row.current_stock_qty) || 0;
    const newQty = current + qty;
    await supabaseServer
      .from("inventory_items")
      .update({ current_stock_qty: newQty })
      .eq("id", line.inventory_item_id)
      .eq("restaurant_id", restaurantId);
  }

  await supabaseServer
    .from("delivery_notes")
    .update({ status: "validated", updated_at: new Date().toISOString() })
    .eq("id", deliveryNoteId);

  revalidatePath(`/receiving/${deliveryNoteId}`);
  revalidatePath("/inventory");
}

