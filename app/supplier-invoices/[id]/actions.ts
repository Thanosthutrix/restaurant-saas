"use server";

import { revalidatePath } from "next/cache";
import { linkDeliveryNotesToSupplierInvoice, updateSupplierInvoice, updateSupplierInvoiceStatus } from "@/lib/db";
import { runSupplierInvoiceAnalysis } from "@/lib/run-supplier-invoice-analysis";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveReceptionLineUnitCosts } from "@/lib/stock/receptionUnitCost";

export async function linkReceptionsToInvoiceAction(
  invoiceId: string,
  deliveryNoteIds: string[],
  restaurantId: string
): Promise<{ error: string | null }> {
  const { error } = await linkDeliveryNotesToSupplierInvoice(invoiceId, deliveryNoteIds, restaurantId);
  if (error) return { error: error.message };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath("/supplier-invoices");
  revalidatePath(`/suppliers/[id]`, "page");
  return { error: null };
}

export type UpdateInvoiceMetadataResult = { success: true } | { success: false; error: string };

export async function updateSupplierInvoiceMetadataAction(
  invoiceId: string,
  restaurantId: string,
  formData: FormData
): Promise<UpdateInvoiceMetadataResult> {
  const invoiceNumber = formData.get("invoice_number");
  const invoiceDate = formData.get("invoice_date");
  const amountHt = formData.get("amount_ht");
  const amountTtc = formData.get("amount_ttc");

  const invoice_number =
    typeof invoiceNumber === "string" ? (invoiceNumber.trim() || null) : null;
  const invoice_date =
    typeof invoiceDate === "string" && invoiceDate.trim()
      ? invoiceDate.trim()
      : null;
  let amount_ht: number | null = null;
  let amount_ttc: number | null = null;
  if (typeof amountHt === "string" && amountHt.trim()) {
    const n = parseFloat(amountHt.replace(",", "."));
    if (!Number.isNaN(n)) amount_ht = n;
  }
  if (typeof amountTtc === "string" && amountTtc.trim()) {
    const n = parseFloat(amountTtc.replace(",", "."));
    if (!Number.isNaN(n)) amount_ttc = n;
  }

  const { data, error } = await updateSupplierInvoice(invoiceId, restaurantId, {
    invoice_number,
    invoice_date,
    amount_ht,
    amount_ttc,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath("/supplier-invoices");
  revalidatePath(`/suppliers/${data?.supplier_id ?? ""}`, "page");
  return { success: true };
}

export type RerunInvoiceAnalysisResult =
  | { success: true; message?: string }
  | { success: false; error: string };

/** Relance l’analyse sur le fichier (image). Ne modifie pas le stock. */
export async function rerunInvoiceAnalysisAction(
  invoiceId: string,
  restaurantId: string
): Promise<RerunInvoiceAnalysisResult> {
  const result = await runSupplierInvoiceAnalysis(invoiceId, restaurantId);
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath("/supplier-invoices");
  revalidatePath("/suppliers/[id]", "page");
  return { success: true };
}

async function applyInvoiceCostsToValidatedReceptions(invoiceId: string, restaurantId: string): Promise<void> {
  const { data: pivots, error: pivotErr } = await supabaseServer
    .from("supplier_invoice_delivery_notes")
    .select("delivery_note_id")
    .eq("supplier_invoice_id", invoiceId);
  if (pivotErr) throw new Error(pivotErr.message);

  const deliveryNoteIds = (pivots ?? []).map((p: { delivery_note_id: string }) => p.delivery_note_id);
  if (deliveryNoteIds.length === 0) return;

  const { data: notes, error: notesErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, status")
    .in("id", deliveryNoteIds)
    .eq("restaurant_id", restaurantId);
  if (notesErr) throw new Error(notesErr.message);
  const validatedNoteIds = new Set(
    (notes ?? [])
      .filter((n: { status: string }) => n.status === "validated" || n.status === "received")
      .map((n: { id: string }) => n.id)
  );
  if (validatedNoteIds.size === 0) return;

  const { data: rawLines, error: linesErr } = await supabaseServer
    .from("delivery_note_lines")
    .select(
      "id, delivery_note_id, inventory_item_id, qty_received, label, purchase_order_line_id, bl_line_total_ht, bl_unit_price_stock_ht, manual_unit_price_stock_ht, supplier_invoice_extracted_line_id"
    )
    .in("delivery_note_id", [...validatedNoteIds]);
  if (linesErr) throw new Error(linesErr.message);

  const lines = (rawLines ?? []).filter((l: { inventory_item_id: string | null }) => l.inventory_item_id);
  if (lines.length === 0) return;

  const unitCostByLineId = await resolveReceptionLineUnitCosts({
    restaurantId,
    supplierInvoiceId: invoiceId,
    lines: lines.map((l) => {
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
      return {
        id: row.id,
        label: row.label ?? null,
        inventory_item_id: row.inventory_item_id,
        qty_received: Number(row.qty_received) || 0,
        purchase_order_line_id: row.purchase_order_line_id ?? null,
        bl_line_total_ht: row.bl_line_total_ht != null ? Number(row.bl_line_total_ht) : null,
        bl_unit_price_stock_ht: row.bl_unit_price_stock_ht != null ? Number(row.bl_unit_price_stock_ht) : null,
        manual_unit_price_stock_ht:
          row.manual_unit_price_stock_ht != null ? Number(row.manual_unit_price_stock_ht) : null,
        supplier_invoice_extracted_line_id: row.supplier_invoice_extracted_line_id ?? null,
      };
    }),
  });

  for (const line of lines as { id: string }[]) {
    const unitCost = unitCostByLineId[line.id];
    if (unitCost == null || !Number.isFinite(unitCost) || unitCost <= 0) continue;

    const { data: movements, error: movErr } = await supabaseServer
      .from("stock_movements")
      .update({ unit_cost: unitCost, supplier_invoice_id: invoiceId })
      .eq("restaurant_id", restaurantId)
      .eq("delivery_note_line_id", line.id)
      .select("id");
    if (movErr) throw new Error(movErr.message);

    const movementIds = (movements ?? []).map((m: { id: string }) => m.id);
    if (movementIds.length > 0) {
      const { error: lotsErr } = await supabaseServer
        .from("inventory_stock_lots")
        .update({ unit_cost: unitCost })
        .in("source_stock_movement_id", movementIds);
      if (lotsErr) throw new Error(lotsErr.message);
    }
  }
}

export async function markSupplierInvoiceReviewedAction(
  invoiceId: string,
  restaurantId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await applyInvoiceCostsToValidatedReceptions(invoiceId, restaurantId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Impossible d’appliquer les coûts facture." };
  }
  const { error } = await updateSupplierInvoiceStatus(invoiceId, restaurantId, "reviewed");
  if (error) return { success: false, error: error.message };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath("/supplier-invoices");
  revalidatePath("/suppliers/[id]", "page");
  return { success: true };
}
