/**
 * Couche 3 — valorisation FIFO (lots + allocations).
 *
 * Étapes : entrées (achat, ajustement +) → `inventory_stock_lots` ; sorties (consommation, ajustement -) →
 * `stock_lot_allocations` en puisant les lots les plus anciens d’abord. Annulation d’un service : restitution
 * des quantités sur les lots puis suppression des mouvements `consumption` concernés.
 */

import { supabaseServer } from "@/lib/supabaseServer";

const EPS = 1e-9;

/** Libellé unique des mouvements de consommation liés à un service (doit rester aligné avec la suppression). */
export function serviceConsumptionReferenceLabel(serviceId: string): string {
  return `Service ${serviceId}`;
}

/** Inverse de `serviceConsumptionReferenceLabel` pour regrouper les mouvements de conso par service. */
export function tryParseServiceIdFromConsumptionLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const prefix = "Service ";
  if (!label.startsWith(prefix)) return null;
  const id = label.slice(prefix.length).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}

export async function createLotForSourceMovement(params: {
  restaurantId: string;
  inventoryItemId: string;
  sourceStockMovementId: string;
  qtyInitial: number;
  unitCost: number | null;
  openedAt: string;
}): Promise<{ error: Error | null }> {
  if (params.qtyInitial <= EPS) return { error: null };
  const { error } = await supabaseServer.from("inventory_stock_lots").insert({
    restaurant_id: params.restaurantId,
    inventory_item_id: params.inventoryItemId,
    source_stock_movement_id: params.sourceStockMovementId,
    qty_initial: params.qtyInitial,
    qty_remaining: params.qtyInitial,
    unit_cost: params.unitCost,
    opened_at: params.openedAt,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

/** CMP des lots encore ouverts ayant un coût connu (pour valoriser un ajustement positif). */
export async function weightedAverageUnitCostForRemaining(
  restaurantId: string,
  inventoryItemId: string
): Promise<number | null> {
  const { data, error } = await supabaseServer
    .from("inventory_stock_lots")
    .select("qty_remaining, unit_cost")
    .eq("restaurant_id", restaurantId)
    .eq("inventory_item_id", inventoryItemId)
    .gt("qty_remaining", EPS);

  if (error || !data?.length) return null;
  let sumVal = 0;
  let sumQty = 0;
  for (const row of data) {
    const qr = Number((row as { qty_remaining: string | number }).qty_remaining);
    const uc = (row as { unit_cost: string | number | null }).unit_cost;
    if (uc == null || !Number.isFinite(Number(uc))) continue;
    if (!Number.isFinite(qr) || qr <= EPS) continue;
    sumVal += qr * Number(uc);
    sumQty += qr;
  }
  if (sumQty <= EPS) return null;
  return sumVal / sumQty;
}

/**
 * Alloue une sortie sur les lots FIFO ; le reliquat sans lot disponible est enregistré avec lot_id NULL (coût inconnu).
 */
export async function allocateFifoForOutboundMovement(params: {
  outboundStockMovementId: string;
  restaurantId: string;
  inventoryItemId: string;
  /** Quantité absolue à allouer (> 0). */
  quantityPositive: number;
}): Promise<{ error: Error | null }> {
  let remaining = params.quantityPositive;
  if (remaining <= EPS) return { error: null };

  while (remaining > EPS) {
    const { data: lots, error: lotErr } = await supabaseServer
      .from("inventory_stock_lots")
      .select("id, qty_remaining, unit_cost")
      .eq("restaurant_id", params.restaurantId)
      .eq("inventory_item_id", params.inventoryItemId)
      .gt("qty_remaining", EPS)
      .order("opened_at", { ascending: true })
      .limit(1);

    if (lotErr) return { error: new Error(lotErr.message) };
    const lot = lots?.[0] as { id: string; qty_remaining: unknown; unit_cost: unknown } | undefined;
    if (!lot) break;

    const qr = Number(lot.qty_remaining);
    if (!Number.isFinite(qr) || qr <= EPS) break;
    const take = Math.min(remaining, qr);
    const unitCost =
      lot.unit_cost != null && Number.isFinite(Number(lot.unit_cost)) ? Number(lot.unit_cost) : null;

    const { error: insErr } = await supabaseServer.from("stock_lot_allocations").insert({
      outbound_stock_movement_id: params.outboundStockMovementId,
      lot_id: lot.id,
      quantity: take,
      unit_cost: unitCost,
    });
    if (insErr) return { error: new Error(insErr.message) };

    const newRem = qr - take;
    const { error: updErr } = await supabaseServer
      .from("inventory_stock_lots")
      .update({ qty_remaining: newRem })
      .eq("id", lot.id);
    if (updErr) return { error: new Error(updErr.message) };

    remaining -= take;
  }

  if (remaining > EPS) {
    const { error: insErr } = await supabaseServer.from("stock_lot_allocations").insert({
      outbound_stock_movement_id: params.outboundStockMovementId,
      lot_id: null,
      quantity: remaining,
      unit_cost: null,
    });
    if (insErr) return { error: new Error(insErr.message) };
  }

  return { error: null };
}

/**
 * Supprime les mouvements de consommation d’un service et restaure les lots (inverse des allocations).
 * À appeler avant de mettre à jour `inventory_items.current_stock_qty`.
 */
export async function revertServiceConsumptionMovements(
  restaurantId: string,
  serviceId: string
): Promise<{ error: Error | null }> {
  const label = serviceConsumptionReferenceLabel(serviceId);
  const { data: movements, error: movErr } = await supabaseServer
    .from("stock_movements")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("movement_type", "consumption")
    .eq("reference_label", label);

  if (movErr) return { error: new Error(movErr.message) };
  const ids = (movements ?? []).map((m) => (m as { id: string }).id);
  if (ids.length === 0) return { error: null };

  const { data: allocations, error: allocErr } = await supabaseServer
    .from("stock_lot_allocations")
    .select("lot_id, quantity")
    .in("outbound_stock_movement_id", ids);

  if (allocErr) return { error: new Error(allocErr.message) };

  for (const a of allocations ?? []) {
    const row = a as { lot_id: string | null; quantity: string | number };
    if (row.lot_id == null) continue;
    const qty = Number(row.quantity);
    if (!Number.isFinite(qty) || qty <= EPS) continue;

    const { data: lot, error: fetchLotErr } = await supabaseServer
      .from("inventory_stock_lots")
      .select("qty_remaining, qty_initial")
      .eq("id", row.lot_id)
      .single();

    if (fetchLotErr || !lot) continue;
    const lo = lot as { qty_remaining: string | number; qty_initial: string | number };
    const newRem = Number(lo.qty_remaining) + qty;
    const cap = Number(lo.qty_initial);
    if (newRem > cap + 1e-6) {
      return {
        error: new Error(
          `Incohérence FIFO : restitution dépasserait la quantité initiale du lot (${row.lot_id}).`
        ),
      };
    }

    const { error: updErr } = await supabaseServer
      .from("inventory_stock_lots")
      .update({ qty_remaining: Math.min(newRem, cap) })
      .eq("id", row.lot_id);
    if (updErr) return { error: new Error(updErr.message) };
  }

  const { error: delErr } = await supabaseServer.from("stock_movements").delete().in("id", ids);
  if (delErr) return { error: new Error(delErr.message) };

  return { error: null };
}

// --- Affichage fiche article (lots ouverts + valorisation partielle) ---

export type FifoLotDisplayRow = {
  lotId: string;
  qtyRemaining: number;
  qtyInitial: number;
  unitCost: number | null;
  openedAt: string;
  movementReference: string | null;
};

export type FifoItemSummary = {
  /** Somme des qty_remaining des lots ouverts (cohérent avec le stock FIFO courant). */
  qtyInOpenLots: number;
  /** Valeur des lots dont le coût est connu (€ HT). */
  valueKnownCostEur: number | null;
  openLots: FifoLotDisplayRow[];
};

function emptyFifoSummary(): FifoItemSummary {
  return { qtyInOpenLots: 0, valueKnownCostEur: null, openLots: [] };
}

/** Lots encore ouverts + valeur estimée (coûts renseignés uniquement). */
export async function getFifoSummaryForInventoryItem(
  restaurantId: string,
  inventoryItemId: string
): Promise<{ data: FifoItemSummary; error: Error | null }> {
  const { data: lots, error: lotsErr } = await supabaseServer
    .from("inventory_stock_lots")
    .select("id, qty_initial, qty_remaining, unit_cost, opened_at, source_stock_movement_id")
    .eq("restaurant_id", restaurantId)
    .eq("inventory_item_id", inventoryItemId)
    .gt("qty_remaining", EPS)
    .order("opened_at", { ascending: true });

  if (lotsErr) return { data: emptyFifoSummary(), error: new Error(lotsErr.message) };

  const rows = lots ?? [];
  const movementIds = [
    ...new Set(rows.map((r) => (r as { source_stock_movement_id: string }).source_stock_movement_id)),
  ];
  const refByMovId = new Map<string, string | null>();
  if (movementIds.length > 0) {
    const { data: movs, error: mErr } = await supabaseServer
      .from("stock_movements")
      .select("id, reference_label")
      .in("id", movementIds);
    if (mErr) return { data: emptyFifoSummary(), error: new Error(mErr.message) };
    for (const m of movs ?? []) {
      refByMovId.set(
        (m as { id: string }).id,
        (m as { reference_label: string | null }).reference_label
      );
    }
  }

  let qtyInOpenLots = 0;
  let valueKnown = 0;
  let hasKnown = false;
  const openLots: FifoLotDisplayRow[] = [];

  for (const raw of rows) {
    const r = raw as {
      id: string;
      qty_initial: string | number;
      qty_remaining: string | number;
      unit_cost: string | number | null;
      opened_at: string;
      source_stock_movement_id: string;
    };
    const qr = Number(r.qty_remaining);
    const qi = Number(r.qty_initial);
    const uc = r.unit_cost != null ? Number(r.unit_cost) : null;
    if (Number.isFinite(qr)) qtyInOpenLots += qr;
    if (uc != null && Number.isFinite(uc) && Number.isFinite(qr)) {
      valueKnown += qr * uc;
      hasKnown = true;
    }
    openLots.push({
      lotId: r.id,
      qtyRemaining: Number.isFinite(qr) ? qr : 0,
      qtyInitial: Number.isFinite(qi) ? qi : 0,
      unitCost: uc != null && Number.isFinite(uc) ? uc : null,
      openedAt: r.opened_at,
      movementReference: refByMovId.get(r.source_stock_movement_id) ?? null,
    });
  }

  return {
    data: {
      qtyInOpenLots,
      valueKnownCostEur: hasKnown ? Math.round(valueKnown * 100) / 100 : null,
      openLots,
    },
    error: null,
  };
}
