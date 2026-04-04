/**
 * Coût unitaire (€ HT / unité de stock) à la validation d’une réception.
 * Priorité : 1) prix manuel ligne réception, 2) ligne facture liée, 3) prix BL, 4) rapprochement facture par libellé, 5) dernier achat (mouvements), 6) prix de référence fiche composant.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { labelsRoughlyMatch } from "@/lib/invoice-reconciliation";
import type { SupplierInvoiceAnalysisLine } from "@/lib/supplier-invoice-analysis";
import { getLastKnownPurchaseUnitCostByItemIds } from "@/lib/stock/purchasePriceHistory";

export type DeliveryNoteLineForCosting = {
  id: string;
  label: string | null;
  inventory_item_id: string | null;
  qty_received: number;
  purchase_order_line_id: string | null;
  bl_line_total_ht?: number | null;
  bl_unit_price_stock_ht?: number | null;
  /** € HT / unité de stock, prioritaire. */
  manual_unit_price_stock_ht?: number | null;
  supplier_invoice_extracted_line_id?: string | null;
};

type ExtractedRow = SupplierInvoiceAnalysisLine & {
  id: string;
  supplier_invoice_id: string;
};

function roundUnit(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function unitCostFromBlLineFields(
  qtyReceivedStock: number,
  blLineTotalHt: number | null | undefined,
  blUnitPriceStockHt: number | null | undefined
): number | null {
  if (!Number.isFinite(qtyReceivedStock) || qtyReceivedStock <= 0) return null;

  const total = blLineTotalHt != null ? Number(blLineTotalHt) : null;
  if (total != null && Number.isFinite(total) && total > 0) {
    const v = total / qtyReceivedStock;
    return Number.isFinite(v) && v > 0 ? roundUnit(v) : null;
  }

  const unit = blUnitPriceStockHt != null ? Number(blUnitPriceStockHt) : null;
  if (unit != null && Number.isFinite(unit) && unit > 0) return roundUnit(unit);

  return null;
}

export function unitCostStockFromExtractedLine(
  el: Pick<SupplierInvoiceAnalysisLine, "line_total" | "unit_price" | "quantity">,
  qtyReceivedStock: number,
  purchaseToStockRatio: number | null
): number | null {
  if (!Number.isFinite(qtyReceivedStock) || qtyReceivedStock <= 0) return null;

  const lt = el.line_total != null ? Number(el.line_total) : null;
  if (lt != null && Number.isFinite(lt) && lt > 0) {
    const v = lt / qtyReceivedStock;
    return Number.isFinite(v) && v > 0 ? roundUnit(v) : null;
  }

  const up = el.unit_price != null ? Number(el.unit_price) : null;
  const ratio = purchaseToStockRatio != null ? Number(purchaseToStockRatio) : null;
  if (up != null && Number.isFinite(up) && up > 0 && ratio != null && Number.isFinite(ratio) && ratio > 0) {
    const v = up / ratio;
    return Number.isFinite(v) && v > 0 ? roundUnit(v) : null;
  }

  return null;
}

async function fetchExtractedLinesByIdsForRestaurant(
  ids: string[],
  restaurantId: string
): Promise<Map<string, ExtractedRow>> {
  const map = new Map<string, ExtractedRow>();
  if (ids.length === 0) return map;

  const { data: rows, error } = await supabaseServer
    .from("supplier_invoice_extracted_lines")
    .select("id, label, quantity, unit, unit_price, line_total, supplier_invoice_id")
    .in("id", ids);

  if (error || !rows?.length) return map;

  const invIds = [...new Set(rows.map((r) => (r as { supplier_invoice_id: string }).supplier_invoice_id))];
  const { data: invs } = await supabaseServer
    .from("supplier_invoices")
    .select("id")
    .in("id", invIds)
    .eq("restaurant_id", restaurantId);

  const allowedInv = new Set((invs ?? []).map((i) => (i as { id: string }).id));

  for (const raw of rows) {
    const r = raw as {
      id: string;
      label: string;
      quantity: unknown;
      unit: unknown;
      unit_price: unknown;
      line_total: unknown;
      supplier_invoice_id: string;
    };
    if (!allowedInv.has(r.supplier_invoice_id)) continue;
    map.set(r.id, {
      id: r.id,
      label: r.label,
      quantity: r.quantity == null ? null : Number(r.quantity),
      unit: r.unit == null ? null : String(r.unit),
      unit_price: r.unit_price == null ? null : Number(r.unit_price),
      line_total: r.line_total == null ? null : Number(r.line_total),
      supplier_invoice_id: r.supplier_invoice_id,
    });
  }

  return map;
}

async function buildPolRatioMap(lines: DeliveryNoteLineForCosting[]): Promise<Map<string, number>> {
  const polIds = [
    ...new Set(lines.map((l) => l.purchase_order_line_id).filter(Boolean) as string[]),
  ];
  const ratioByPolId = new Map<string, number>();
  if (polIds.length === 0) return ratioByPolId;

  const { data: pols } = await supabaseServer
    .from("purchase_order_lines")
    .select("id, purchase_to_stock_ratio")
    .in("id", polIds);

  for (const row of pols ?? []) {
    const r = Number((row as { purchase_to_stock_ratio: unknown }).purchase_to_stock_ratio);
    if (Number.isFinite(r) && r > 0) {
      ratioByPolId.set((row as { id: string }).id, r);
    }
  }

  return ratioByPolId;
}

async function fetchReferencePurchaseUnitCostByItemIds(
  restaurantId: string,
  itemIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (itemIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from("inventory_items")
    .select("id, reference_purchase_unit_cost_ht")
    .eq("restaurant_id", restaurantId)
    .in("id", itemIds);

  if (error || !data) return map;

  for (const row of data) {
    const id = (row as { id: string }).id;
    const raw = (row as { reference_purchase_unit_cost_ht: unknown }).reference_purchase_unit_cost_ht;
    const n = raw == null ? NaN : Number(raw);
    if (Number.isFinite(n) && n > 0) map.set(id, roundUnit(n));
  }
  return map;
}

async function mergeInvoiceCostsInto(
  out: Record<string, number>,
  lines: DeliveryNoteLineForCosting[],
  supplierInvoiceId: string | null,
  restaurantId: string,
  reservedExtractedLineIds: Set<string>
): Promise<void> {
  const candidates = lines.filter(
    (l) => l.inventory_item_id && out[l.id] == null && Number(l.qty_received) > 0
  );
  if (candidates.length === 0 || !supplierInvoiceId) return;

  const { data: extractedRows, error: extErr } = await supabaseServer
    .from("supplier_invoice_extracted_lines")
    .select("id, label, quantity, unit, unit_price, line_total, sort_order")
    .eq("supplier_invoice_id", supplierInvoiceId)
    .order("sort_order", { ascending: true });

  if (extErr || !extractedRows?.length) return;

  const extracted = extractedRows as (SupplierInvoiceAnalysisLine & { id: string })[];

  const itemIds = [
    ...new Set(candidates.map((l) => l.inventory_item_id as string)),
  ];
  const nameByItemId = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: items } = await supabaseServer
      .from("inventory_items")
      .select("id, name")
      .in("id", itemIds)
      .eq("restaurant_id", restaurantId);
    for (const row of items ?? []) {
      nameByItemId.set((row as { id: string }).id, String((row as { name: string }).name));
    }
  }

  const ratioByPolId = await buildPolRatioMap(candidates);

  const usedExtractedIndex = new Set<number>();

  for (const line of candidates) {
    const qtyRec = Number(line.qty_received);
    const itemName = nameByItemId.get(line.inventory_item_id as string) ?? null;
    const ratio = line.purchase_order_line_id
      ? ratioByPolId.get(line.purchase_order_line_id) ?? null
      : null;

    let bestIdx = -1;
    for (let i = 0; i < extracted.length; i++) {
      if (usedExtractedIndex.has(i)) continue;
      const eid = extracted[i].id;
      if (reservedExtractedLineIds.has(eid)) continue;
      if (labelsRoughlyMatch(extracted[i].label, line.label, itemName)) {
        bestIdx = i;
        break;
      }
    }
    if (bestIdx < 0) continue;

    usedExtractedIndex.add(bestIdx);
    const cost = unitCostStockFromExtractedLine(extracted[bestIdx], qtyRec, ratio);
    if (cost != null) out[line.id] = cost;
  }
}

/**
 * Map `delivery_note_line.id` → coût unitaire stock (€ HT).
 */
export async function resolveReceptionLineUnitCosts(params: {
  restaurantId: string;
  supplierInvoiceId: string | null;
  lines: DeliveryNoteLineForCosting[];
}): Promise<Record<string, number>> {
  const out: Record<string, number> = {};

  const linkedIds = [
    ...new Set(
      params.lines.map((l) => l.supplier_invoice_extracted_line_id).filter(Boolean) as string[]
    ),
  ];
  const extractedById = await fetchExtractedLinesByIdsForRestaurant(
    linkedIds,
    params.restaurantId
  );
  const ratioByPolId = await buildPolRatioMap(params.lines);

  const reservedExtractedForFuzzy = new Set<string>();

  for (const line of params.lines) {
    if (!line.inventory_item_id) continue;
    const qtyRec = Number(line.qty_received);
    if (!Number.isFinite(qtyRec) || qtyRec <= 0) continue;

    const manual = line.manual_unit_price_stock_ht;
    if (manual != null && Number.isFinite(Number(manual)) && Number(manual) > 0) {
      out[line.id] = roundUnit(Number(manual));
      continue;
    }

    const exId = line.supplier_invoice_extracted_line_id;
    if (exId && params.supplierInvoiceId) {
      const row = extractedById.get(exId);
      if (row && row.supplier_invoice_id === params.supplierInvoiceId) {
        const ratio = line.purchase_order_line_id
          ? ratioByPolId.get(line.purchase_order_line_id) ?? null
          : null;
        const cost = unitCostStockFromExtractedLine(row, qtyRec, ratio);
        if (cost != null) {
          out[line.id] = cost;
          reservedExtractedForFuzzy.add(exId);
          continue;
        }
      }
    }

    const fromBl = unitCostFromBlLineFields(
      qtyRec,
      line.bl_line_total_ht,
      line.bl_unit_price_stock_ht
    );
    if (fromBl != null) out[line.id] = fromBl;
  }

  await mergeInvoiceCostsInto(
    out,
    params.lines,
    params.supplierInvoiceId,
    params.restaurantId,
    reservedExtractedForFuzzy
  );

  const stillMissing = params.lines.filter(
    (l) =>
      l.inventory_item_id &&
      out[l.id] == null &&
      Number(l.qty_received) > 0
  );
  if (stillMissing.length === 0) return out;

  const itemIds = [...new Set(stillMissing.map((l) => l.inventory_item_id as string))];
  const lastMap = await getLastKnownPurchaseUnitCostByItemIds(params.restaurantId, itemIds);

  for (const line of stillMissing) {
    const lk = lastMap.get(line.inventory_item_id as string);
    if (lk != null) out[line.id] = lk;
  }

  const stillAfterLast = params.lines.filter(
    (l) =>
      l.inventory_item_id &&
      out[l.id] == null &&
      Number(l.qty_received) > 0
  );
  if (stillAfterLast.length === 0) return out;

  const itemIdsForRef = [...new Set(stillAfterLast.map((l) => l.inventory_item_id as string))];
  const refMap = await fetchReferencePurchaseUnitCostByItemIds(params.restaurantId, itemIdsForRef);

  for (const line of stillAfterLast) {
    const ref = refMap.get(line.inventory_item_id as string);
    if (ref != null) out[line.id] = ref;
  }

  return out;
}
