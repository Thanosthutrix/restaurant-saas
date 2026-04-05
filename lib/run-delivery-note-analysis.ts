import { supabaseServer } from "@/lib/supabaseServer";
import {
  analyzeDeliveryNoteDocument,
  DELIVERY_NOTE_ANALYSIS_VERSION,
} from "@/lib/delivery-note-openai";
import { getDeliveryNoteFileUrl } from "@/lib/db";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";

type ParsedLine = {
  label: string;
  quantity: number;
  unit: string | null;
  blLineTotalHt: number | null;
  blUnitPriceStockHt: number | null;
};

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function asNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseLinesFromJson(json: Record<string, unknown>): ParsedLine[] {
  const raw = json.lines;
  if (!Array.isArray(raw)) return [];
  const out: ParsedLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = asString(o.label);
    if (!label) continue;
    const qty = asNumber(o.quantity) ?? 0;
    const unit = asString(o.unit);
    const unitPrice = asNumber(o.unit_price_ht);
    const lineTotal = asNumber(o.line_total_ht);
    out.push({
      label,
      quantity: qty > 0 ? qty : 0,
      unit,
      blLineTotalHt: lineTotal != null && lineTotal > 0 ? lineTotal : null,
      blUnitPriceStockHt: unitPrice != null && unitPrice > 0 ? unitPrice : null,
    });
  }
  return out;
}

/** Correspondance libellé BL → article stock (exact puis inclusion). */
export function matchInventoryItemForLabel(
  label: string,
  items: { id: string; name: string }[]
): string | null {
  const raw = normalizeInventoryItemName(label);
  if (!raw) return null;
  for (const i of items) {
    if (normalizeInventoryItemName(i.name) === raw) return i.id;
  }
  for (const i of items) {
    const inv = normalizeInventoryItemName(i.name);
    if (!inv || inv.length < 2) continue;
    if (raw.includes(inv) || inv.includes(raw)) return i.id;
  }
  return null;
}

/**
 * Après upload d’un BL sans commande app : extrait les lignes (IA), rattache les articles stock si possible.
 */
export async function runDeliveryNoteAnalysis(
  deliveryNoteId: string,
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: note, error: nErr } = await supabaseServer
    .from("delivery_notes")
    .select(
      "id, restaurant_id, supplier_id, file_path, file_name, file_url, status, purchase_order_id"
    )
    .eq("id", deliveryNoteId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (nErr || !note) {
    return { ok: false, error: "Réception introuvable." };
  }

  const row = note as {
    status: string;
    file_path: string | null;
    file_url: string | null;
    file_name: string | null;
    purchase_order_id: string | null;
  };

  if (row.status !== "draft") {
    return { ok: false, error: "Seules les réceptions en brouillon peuvent être analysées." };
  }

  const { data: existingRows } = await supabaseServer
    .from("delivery_note_lines")
    .select("id")
    .eq("delivery_note_id", deliveryNoteId)
    .limit(1);

  if (existingRows && existingRows.length > 0) {
    return { ok: true };
  }

  const publicUrl =
    row.file_url ?? (row.file_path ? getDeliveryNoteFileUrl(row.file_path) : null);
  if (!publicUrl) {
    return { ok: false, error: "Aucun fichier BL associé." };
  }

  const fileName = row.file_name ?? "bl.jpg";
  const outcome = await analyzeDeliveryNoteDocument(publicUrl, fileName);
  const now = new Date().toISOString();

  if (outcome.kind === "skipped_no_key" || outcome.kind === "skipped_pdf") {
    await supabaseServer
      .from("delivery_notes")
      .update({
        notes: outcome.message,
        updated_at: now,
      })
      .eq("id", deliveryNoteId)
      .eq("restaurant_id", restaurantId);
    return { ok: true };
  }

  if (outcome.kind === "error") {
    await supabaseServer
      .from("delivery_notes")
      .update({
        notes: `Analyse BL : ${outcome.message}`,
        updated_at: now,
      })
      .eq("id", deliveryNoteId)
      .eq("restaurant_id", restaurantId);
    return { ok: false, error: outcome.message };
  }

  const json = outcome.result.json;
  const supplierNameOnDoc = asString(json.supplier_name_on_document);
  const blNumber = asString(json.bl_number);
  const deliveryDate = asString(json.delivery_date);
  const rawText = asString(json.raw_text);
  const parsedLines = parseLinesFromJson(json);

  const { data: invRows } = await supabaseServer
    .from("inventory_items")
    .select("id, name")
    .eq("restaurant_id", restaurantId);

  const invItems = (invRows ?? []) as { id: string; name: string }[];

  const notePatch: Record<string, unknown> = {
    raw_text: rawText,
    updated_at: now,
    notes: supplierNameOnDoc
      ? `Fournisseur sur le document : ${supplierNameOnDoc}. Analyse v${DELIVERY_NOTE_ANALYSIS_VERSION}.`
      : `Analyse BL v${DELIVERY_NOTE_ANALYSIS_VERSION}.`,
  };
  if (blNumber) notePatch.number = blNumber;
  if (deliveryDate) notePatch.delivery_date = deliveryDate;

  await supabaseServer
    .from("delivery_notes")
    .update(notePatch)
    .eq("id", deliveryNoteId)
    .eq("restaurant_id", restaurantId);

  if (parsedLines.length === 0) {
    return { ok: true };
  }

  const rows = parsedLines.map((l, index) => {
    const inventoryItemId = matchInventoryItemForLabel(l.label, invItems);
    const qtyD = l.quantity;
    const qtyR = qtyD;
    return {
      delivery_note_id: deliveryNoteId,
      purchase_order_line_id: null,
      inventory_item_id: inventoryItemId,
      label: l.label,
      qty_ordered: 0,
      qty_delivered: qtyD,
      qty_received: qtyR,
      unit: l.unit,
      sort_order: index,
      bl_line_total_ht: l.blLineTotalHt,
      bl_unit_price_stock_ht: l.blUnitPriceStockHt,
      manual_unit_price_stock_ht: null,
      supplier_invoice_extracted_line_id: null,
    };
  });

  const { error: insErr } = await supabaseServer.from("delivery_note_lines").insert(rows);
  if (insErr) {
    return { ok: false, error: insErr.message };
  }

  return { ok: true };
}
