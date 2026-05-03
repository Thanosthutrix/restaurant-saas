"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { getRestaurantForPage, getCurrentUser } from "@/lib/auth";
import { getDeliveryNoteFileUrl } from "@/lib/db";
import { DELIVERY_NOTES_BUCKET, TRACEABILITY_ELEMENT_TYPES } from "@/lib/constants";
import { resolveReceptionLineUnitCosts } from "@/lib/stock/receptionUnitCost";
import {
  getSupplierInvoiceIdForDeliveryNote,
  insertPurchaseMovementsFromReception,
} from "@/lib/stock/stockMovements";
import { upsertDeliveryLabelAlias } from "@/lib/inventoryDeliveryLabelAliases";
import { createInventoryItem, updateInventoryItemSupplier } from "@/app/inventory/actions";

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
    received_temperature_celsius?: number | null;
    lot_number?: string | null;
    expiry_date?: string | null;
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
    received_temperature_celsius: params.received_temperature_celsius ?? null,
    lot_number:
      params.lot_number == null || String(params.lot_number).trim() === ""
        ? null
        : String(params.lot_number).trim(),
    expiry_date:
      params.expiry_date == null || String(params.expiry_date).trim() === ""
        ? null
        : String(params.expiry_date).trim().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/receiving/${deliveryNoteId}`);
}

export async function setDeliveryNoteLineInventoryItemAction(
  deliveryNoteId: string,
  restaurantId: string,
  lineId: string,
  inventoryItemId: string | null
): Promise<void> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant || restaurant.id !== restaurantId) {
    throw new Error("Non autorisé.");
  }

  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, status")
    .eq("id", deliveryNoteId)
    .single();
  if (noteErr || !note) throw new Error("Réception introuvable.");
  if ((note as { restaurant_id: string }).restaurant_id !== restaurantId) {
    throw new Error("Réception non liée à ce restaurant.");
  }
  if ((note as { status: string }).status === "validated") {
    throw new Error("Cette réception est validée. Impossible de modifier le produit lié.");
  }

  if (inventoryItemId) {
    const { data: item, error: itemErr } = await supabaseServer
      .from("inventory_items")
      .select("id")
      .eq("id", inventoryItemId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error("Article stock introuvable.");
  }

  const { error } = await supabaseServer
    .from("delivery_note_lines")
    .update({ inventory_item_id: inventoryItemId })
    .eq("id", lineId)
    .eq("delivery_note_id", deliveryNoteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/receiving/${deliveryNoteId}`);
}

export async function createInventoryItemFromDeliveryLineAction(
  deliveryNoteId: string,
  restaurantId: string,
  lineId: string,
  params: {
    name: string;
    unit: string;
    itemType: "ingredient" | "prep" | "resale";
  }
): Promise<{ ok: true; inventoryItemId: string } | { ok: false; error: string }> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant || restaurant.id !== restaurantId) {
    return { ok: false, error: "Non autorisé." };
  }

  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, supplier_id, status")
    .eq("id", deliveryNoteId)
    .maybeSingle();
  if (noteErr) return { ok: false, error: noteErr.message };
  if (!note || (note as { restaurant_id: string }).restaurant_id !== restaurantId) {
    return { ok: false, error: "Réception introuvable." };
  }
  if ((note as { status: string }).status === "validated") {
    return { ok: false, error: "Cette réception est validée. Impossible de créer un produit lié." };
  }

  const { data: line, error: lineErr } = await supabaseServer
    .from("delivery_note_lines")
    .select("id, label, qty_received, bl_line_total_ht, bl_unit_price_stock_ht")
    .eq("id", lineId)
    .eq("delivery_note_id", deliveryNoteId)
    .maybeSingle();
  if (lineErr) return { ok: false, error: lineErr.message };
  if (!line) return { ok: false, error: "Ligne BL introuvable." };

  const label = String((line as { label?: string | null }).label ?? "").trim();
  const name = params.name.trim() || label;
  const created = await createInventoryItem({
    restaurantId,
    name,
    unit: params.unit,
    itemType: params.itemType,
    currentStockQty: 0,
    minStockQty: null,
  });
  if (!created.ok) return { ok: false, error: created.error };
  if (!created.data?.id) return { ok: false, error: "Création produit incomplète." };

  const inventoryItemId = created.data.id;
  const qtyReceived = Number((line as { qty_received?: unknown }).qty_received) || 0;
  const lineTotal = Number((line as { bl_line_total_ht?: unknown }).bl_line_total_ht);
  const unitPrice = Number((line as { bl_unit_price_stock_ht?: unknown }).bl_unit_price_stock_ht);
  const referenceCost =
    Number.isFinite(unitPrice) && unitPrice > 0
      ? unitPrice
      : Number.isFinite(lineTotal) && lineTotal > 0 && qtyReceived > 0
        ? Math.round((lineTotal / qtyReceived) * 1_000_000) / 1_000_000
        : null;

  const patch: Record<string, unknown> = {
    supplier_id: (note as { supplier_id: string }).supplier_id,
  };
  if (referenceCost != null) patch.reference_purchase_unit_cost_ht = referenceCost;

  const { error: itemPatchErr } = await supabaseServer
    .from("inventory_items")
    .update(patch)
    .eq("id", inventoryItemId)
    .eq("restaurant_id", restaurantId);
  if (itemPatchErr) return { ok: false, error: itemPatchErr.message };

  const { error: linkErr } = await supabaseServer
    .from("delivery_note_lines")
    .update({ inventory_item_id: inventoryItemId })
    .eq("id", lineId)
    .eq("delivery_note_id", deliveryNoteId);
  if (linkErr) return { ok: false, error: linkErr.message };

  if (label) {
    await upsertDeliveryLabelAlias(
      restaurantId,
      (note as { supplier_id: string }).supplier_id,
      label,
      inventoryItemId
    );
  }

  revalidatePath(`/receiving/${deliveryNoteId}`);
  revalidatePath("/inventory");
  return { ok: true, inventoryItemId };
}

/** Enregistre la liaison libellé BL → article stock pour les prochaines livraisons (ce fournisseur). */
export async function saveDeliveryLabelAliasAction(
  deliveryNoteId: string,
  restaurantId: string,
  rawLabel: string,
  inventoryItemId: string
): Promise<void> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant || restaurant.id !== restaurantId) {
    throw new Error("Non autorisé.");
  }

  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, supplier_id, status")
    .eq("id", deliveryNoteId)
    .single();
  if (noteErr || !note) throw new Error("Réception introuvable.");
  if ((note as { restaurant_id: string }).restaurant_id !== restaurantId) {
    throw new Error("Réception non liée à ce restaurant.");
  }
  if ((note as { status: string }).status === "validated") {
    throw new Error("Cette réception est validée.");
  }

  const { data: item, error: itemErr } = await supabaseServer
    .from("inventory_items")
    .select("id")
    .eq("id", inventoryItemId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (itemErr) throw new Error(itemErr.message);
  if (!item) throw new Error("Article stock introuvable.");

  const supplierId = (note as { supplier_id: string }).supplier_id;
  const { error: aliasErr } = await upsertDeliveryLabelAlias(
    restaurantId,
    supplierId,
    rawLabel,
    inventoryItemId
  );
  if (aliasErr) throw new Error(aliasErr);
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
    received_temperature_celsius?: number | null;
    lot_number?: string | null;
    expiry_date?: string | null;
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
        received_temperature_celsius: line.received_temperature_celsius ?? null,
        lot_number:
          line.lot_number == null || String(line.lot_number).trim() === ""
            ? null
            : String(line.lot_number).trim(),
        expiry_date:
          line.expiry_date == null || String(line.expiry_date).trim() === ""
            ? null
            : String(line.expiry_date).trim().slice(0, 10),
      })
      .eq("id", line.id)
      .eq("delivery_note_id", deliveryNoteId);
  }
  revalidatePath(`/receiving/${deliveryNoteId}`);
}

/** Déduit le type registre depuis le composant stock lié (ingrédient / prépa / revente), sinon « autre ». */
async function resolveTraceabilityElementTypeForLine(
  lineId: string
): Promise<(typeof TRACEABILITY_ELEMENT_TYPES)[number]> {
  const { data, error } = await supabaseServer
    .from("delivery_note_lines")
    .select("inventory_items(item_type)")
    .eq("id", lineId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = data as {
    inventory_items?: { item_type?: string } | { item_type?: string }[] | null;
  } | null;
  const inv = raw?.inventory_items;
  const invRow = Array.isArray(inv) ? inv[0] : inv;
  const itemType = invRow?.item_type;
  if (itemType === "ingredient") return "ingredient";
  if (itemType === "prep") return "prep";
  if (itemType === "resale") return "resale";
  return "other";
}

export async function recordTraceabilityPhotoAction(
  restaurantId: string,
  deliveryNoteId: string,
  lineId: string,
  storagePath: string
): Promise<void> {
  const elementType = await resolveTraceabilityElementTypeForLine(lineId);
  const { data: line, error: lineErr } = await supabaseServer
    .from("delivery_note_lines")
    .select("id, delivery_note_id")
    .eq("id", lineId)
    .maybeSingle();
  if (lineErr) throw new Error(lineErr.message);
  if (!line || (line as { delivery_note_id: string }).delivery_note_id !== deliveryNoteId) {
    throw new Error("Ligne introuvable.");
  }
  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, status")
    .eq("id", deliveryNoteId)
    .maybeSingle();
  if (noteErr) throw new Error(noteErr.message);
  if (!note || (note as { restaurant_id: string }).restaurant_id !== restaurantId) {
    throw new Error("Réception non autorisée.");
  }
  if ((note as { status: string }).status === "validated") {
    throw new Error("Réception validée : impossible d’ajouter une photo.");
  }
  const { error: insErr } = await supabaseServer.from("reception_traceability_photos").insert({
    restaurant_id: restaurantId,
    delivery_note_id: deliveryNoteId,
    delivery_note_line_id: lineId,
    storage_path: storagePath,
    element_type: elementType,
  });
  if (insErr) throw new Error(insErr.message);
  revalidatePath(`/receiving/${deliveryNoteId}`);
  revalidatePath("/receiving/registre");
}

export async function toggleDeliveryNoteLineVerifiedAction(
  deliveryNoteId: string,
  restaurantId: string,
  lineId: string,
  verified: boolean
): Promise<void> {
  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, status")
    .eq("id", deliveryNoteId)
    .maybeSingle();
  if (noteErr) throw new Error(noteErr.message);
  if (!note || (note as { restaurant_id: string }).restaurant_id !== restaurantId) {
    throw new Error("Réception non autorisée.");
  }
  if ((note as { status: string }).status === "validated") {
    throw new Error("Réception validée : impossible de modifier le contrôle des lignes.");
  }
  const { error } = await supabaseServer
    .from("delivery_note_lines")
    .update({
      reception_line_verified_at: verified ? new Date().toISOString() : null,
    })
    .eq("id", lineId)
    .eq("delivery_note_id", deliveryNoteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/receiving/${deliveryNoteId}`);
}

export async function deleteTraceabilityPhotoAction(
  restaurantId: string,
  deliveryNoteId: string,
  photoId: string
): Promise<void> {
  const { data: row, error: fetchErr } = await supabaseServer
    .from("reception_traceability_photos")
    .select("id, restaurant_id, delivery_note_id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (
    !row ||
    (row as { restaurant_id: string }).restaurant_id !== restaurantId ||
    (row as { delivery_note_id: string }).delivery_note_id !== deliveryNoteId
  ) {
    throw new Error("Photo introuvable.");
  }
  const { data: note } = await supabaseServer
    .from("delivery_notes")
    .select("status")
    .eq("id", deliveryNoteId)
    .maybeSingle();
  if ((note as { status: string } | null)?.status === "validated") {
    throw new Error("Réception validée : impossible de supprimer une photo.");
  }
  const path = (row as { storage_path: string }).storage_path;
  const { error: rmErr } = await supabaseServer.storage.from(DELIVERY_NOTES_BUCKET).remove([path]);
  if (rmErr) throw new Error(rmErr.message);
  const { error: delErr } = await supabaseServer.from("reception_traceability_photos").delete().eq("id", photoId);
  if (delErr) throw new Error(delErr.message);
  revalidatePath(`/receiving/${deliveryNoteId}`);
  revalidatePath("/receiving/registre");
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
  revalidatePath("/livraison");
  revalidatePath("/inventory");
}

export async function applyPurchaseConversionFromReceivingAction(params: {
  restaurantId: string;
  deliveryNoteId: string;
  lineId: string;
  inventoryItemId: string;
  purchaseUnit: string;
  unitsPerPurchase: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant || restaurant.id !== params.restaurantId) {
    return { ok: false, error: "Non autorisé." };
  }

  const u = params.unitsPerPurchase;
  if (!Number.isFinite(u) || u <= 0) {
    return {
      ok: false,
      error: "Le ratio doit être un nombre strictement positif (ex. 20000 pour 1 sac = 20 kg exprimé en grammes).",
    };
  }

  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, status, supplier_id")
    .eq("id", params.deliveryNoteId)
    .maybeSingle();
  if (noteErr) return { ok: false, error: noteErr.message };
  if (!note || (note as { restaurant_id: string }).restaurant_id !== params.restaurantId) {
    return { ok: false, error: "Réception introuvable." };
  }
  if ((note as { status: string }).status === "validated") {
    return { ok: false, error: "Réception déjà validée." };
  }

  const { data: row, error: lineErr } = await supabaseServer
    .from("delivery_note_lines")
    .select("id, inventory_item_id, qty_delivered, purchase_order_line_id, label")
    .eq("id", params.lineId)
    .eq("delivery_note_id", params.deliveryNoteId)
    .maybeSingle();
  if (lineErr) return { ok: false, error: lineErr.message };
  if (!row) return { ok: false, error: "Ligne introuvable." };
  if ((row as { inventory_item_id: string | null }).inventory_item_id !== params.inventoryItemId) {
    return { ok: false, error: "Le produit lié à la ligne ne correspond pas." };
  }

  const qtyDelivered = Number((row as { qty_delivered?: unknown }).qty_delivered) || 0;
  const purchaseOrderLineId = (row as { purchase_order_line_id: string | null }).purchase_order_line_id;

  const noteSupplierId = (note as { supplier_id: string | null }).supplier_id;

  const supplierPatch = await updateInventoryItemSupplier({
    itemId: params.inventoryItemId,
    restaurantId: params.restaurantId,
    ...(noteSupplierId ? { supplierId: noteSupplierId } : {}),
    purchaseUnit: params.purchaseUnit.trim() || null,
    unitsPerPurchase: u,
  });
  if (!supplierPatch.ok) return { ok: false, error: supplierPatch.error };

  const qtyReceived = Math.round(qtyDelivered * u * 1000) / 1000;

  const { error: updLineErr } = await supabaseServer
    .from("delivery_note_lines")
    .update({ qty_received: qtyReceived })
    .eq("id", params.lineId)
    .eq("delivery_note_id", params.deliveryNoteId);
  if (updLineErr) return { ok: false, error: updLineErr.message };

  if (purchaseOrderLineId) {
    const { error: polErr } = await supabaseServer
      .from("purchase_order_lines")
      .update({ purchase_to_stock_ratio: u })
      .eq("id", purchaseOrderLineId);
    if (polErr) return { ok: false, error: polErr.message };
  }

  const supplierId = (note as { supplier_id: string }).supplier_id;
  const rawLabel = String((row as { label?: string | null }).label ?? "").trim();
  if (rawLabel) {
    const { error: aliasConvErr } = await upsertDeliveryLabelAlias(
      params.restaurantId,
      supplierId,
      rawLabel,
      params.inventoryItemId,
      {
        purchaseUnit: params.purchaseUnit.trim() || null,
        stockUnitsPerPurchase: u,
      }
    );
    if (aliasConvErr) {
      console.warn("[applyPurchaseConversionFromReceivingAction] alias conversion:", aliasConvErr);
    }
  }

  revalidatePath(`/receiving/${params.deliveryNoteId}`);
  revalidatePath(`/inventory/${params.inventoryItemId}`);
  revalidatePath("/inventory");
  revalidatePath("/orders/suggestions", "page");
  return { ok: true };
}
