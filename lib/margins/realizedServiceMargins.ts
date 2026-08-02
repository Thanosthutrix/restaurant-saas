/**
 * Marge réalisée par service : CA (ticket ou prix carte) vs coût matière FIFO
 * (allocations sur mouvements de consommation `Service {id}`).
 *
 * À défaut de lots valorisés — typiquement quand les factures d'achat ne sont pas
 * encore saisies — le coût théorique des recettes prend le relais, et la ligne est
 * signalée comme estimée plutôt que d'afficher une marge de 100 %.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { computeDishFoodCostHt } from "@/lib/margins/dishMarginAnalysis";
import { tryParseServiceIdFromConsumptionLabel } from "@/lib/stock/fifo";
import { roundMoney } from "@/lib/stock/purchasePriceHistory";

/**
 * Origine du coût matière retenu pour la marge.
 * - `invoiced` : coût réel des lots consommés (réceptions valorisées).
 * - `estimated` : aucun lot valorisé, on retombe sur le coût théorique des recettes.
 * - `mixed` : une partie seulement des sorties était adossée à un lot valorisé.
 */
export type MarginCostBasis = "invoiced" | "estimated" | "mixed";

export const MARGIN_COST_BASIS_LABEL: Record<MarginCostBasis, string> = {
  invoiced: "Coût réel (factures)",
  estimated: "Estimation (sans facture)",
  mixed: "Partiellement estimé",
};

export type RealizedServiceMarginRow = {
  serviceId: string;
  serviceDate: string;
  serviceType: string;
  /** null si aucune ligne de vente n’a pu être valorisée. */
  revenueHt: number | null;
  revenueComplete: boolean;
  revenueNote: string;
  fifoCostHt: number;
  fifoHasUnknownCost: boolean;
  /** Coût matière finalement retenu (réel, estimé, ou les deux). */
  costHt: number;
  costBasis: MarginCostBasis;
  /** Part estimée du coût, pour expliquer un `mixed`. */
  estimatedCostHt: number;
  marginHt: number | null;
  marginPct: number | null;
};

function roundPct(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function fetchServicesInDateRange(
  restaurantId: string,
  fromDate: string,
  toDate: string,
  limit: number
): Promise<{ id: string; service_date: string; service_type: string }[]> {
  const { data, error } = await supabaseServer
    .from("services")
    .select("id, service_date, service_type")
    .eq("restaurant_id", restaurantId)
    .gte("service_date", fromDate)
    .lte("service_date", toDate)
    .order("service_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as { id: string; service_date: string; service_type: string }[];
}

/** Coût FIFO connu par service (allocations) + indicateur si une partie du volume est sans coût lot. */
export async function fifoCostByServiceId(
  restaurantId: string,
  serviceIds: string[]
): Promise<Map<string, { cost: number; hasUnknown: boolean }>> {
  const out = new Map<string, { cost: number; hasUnknown: boolean }>();
  for (const id of serviceIds) {
    out.set(id, { cost: 0, hasUnknown: false });
  }
  if (serviceIds.length === 0) return out;

  const labels = serviceIds.map((sid) => `Service ${sid}`);
  const { data: movements, error: movErr } = await supabaseServer
    .from("stock_movements")
    .select("id, reference_label")
    .eq("restaurant_id", restaurantId)
    .eq("movement_type", "consumption")
    .in("reference_label", labels);

  if (movErr || !movements?.length) return out;

  const movIdToService = new Map<string, string>();
  const movIds: string[] = [];
  for (const m of movements) {
    const row = m as { id: string; reference_label: string };
    const sid = tryParseServiceIdFromConsumptionLabel(row.reference_label);
    if (!sid) continue;
    movIdToService.set(row.id, sid);
    movIds.push(row.id);
  }
  if (movIds.length === 0) return out;

  const { data: allocs, error: allocErr } = await supabaseServer
    .from("stock_lot_allocations")
    .select("outbound_stock_movement_id, quantity, unit_cost")
    .in("outbound_stock_movement_id", movIds);

  if (allocErr || !allocs) return out;

  for (const a of allocs) {
    const row = a as {
      outbound_stock_movement_id: string;
      quantity: unknown;
      unit_cost: unknown;
    };
    const sid = movIdToService.get(row.outbound_stock_movement_id);
    if (!sid) continue;
    const bucket = out.get(sid);
    if (!bucket) continue;
    const q = Number(row.quantity);
    if (!Number.isFinite(q) || q <= 0) continue;
    const uc = row.unit_cost == null ? null : Number(row.unit_cost);
    if (uc == null || !Number.isFinite(uc)) {
      bucket.hasUnknown = true;
      continue;
    }
    bucket.cost = roundMoney(bucket.cost + q * uc);
  }

  return out;
}

type SaleRow = {
  service_id: string;
  qty: unknown;
  line_total_ht: unknown;
  dishes: { selling_price_ht: unknown } | null;
};

/**
 * Coût matière **théorique** de chaque service : recettes dépliées × quantités vendues.
 * Sert de repli quand aucune réception valorisée n'adosse la consommation, pour ne
 * pas laisser croire à une marge de 100 % faute de factures saisies.
 */
export async function theoreticalCostByServiceId(
  restaurantId: string,
  serviceIds: string[]
): Promise<Map<string, { cost: number; complete: boolean }>> {
  const out = new Map<string, { cost: number; complete: boolean }>();
  for (const id of serviceIds) out.set(id, { cost: 0, complete: true });
  if (serviceIds.length === 0) return out;

  const { data: sales, error } = await supabaseServer
    .from("service_sales")
    .select("service_id, dish_id, qty")
    .eq("restaurant_id", restaurantId)
    .in("service_id", serviceIds);

  if (error || !sales?.length) return out;

  const rows = sales as unknown as { service_id: string; dish_id: string; qty: unknown }[];

  // Un plat revient sur de nombreux services : on ne calcule sa recette qu'une fois.
  const unitCostByDish = new Map<string, { unit: number; complete: boolean }>();
  for (const dishId of new Set(rows.map((r) => r.dish_id))) {
    const res = await computeDishFoodCostHt(restaurantId, dishId);
    unitCostByDish.set(dishId, { unit: res.foodCostHt, complete: res.costIsComplete });
  }

  for (const r of rows) {
    const qty = Number(r.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const bucket = out.get(r.service_id);
    if (!bucket) continue;
    const fc = unitCostByDish.get(r.dish_id);
    if (!fc || !fc.complete || fc.unit <= 0) {
      bucket.complete = false;
      if (!fc || fc.unit <= 0) continue;
    }
    bucket.cost = roundMoney(bucket.cost + fc.unit * qty);
  }

  return out;
}

async function revenueByServiceId(
  restaurantId: string,
  serviceIds: string[]
): Promise<Map<string, { total: number | null; complete: boolean; note: string }>> {
  const out = new Map<string, { total: number | null; complete: boolean; note: string }>();

  if (serviceIds.length === 0) return out;

  const { data: sales, error } = await supabaseServer
    .from("service_sales")
    .select("service_id, qty, line_total_ht, dishes(selling_price_ht)")
    .eq("restaurant_id", restaurantId)
    .in("service_id", serviceIds);

  const byService = new Map<string, SaleRow[]>();
  if (!error && sales?.length) {
    for (const raw of sales as unknown as SaleRow[]) {
      const sid = raw.service_id;
      const list = byService.get(sid) ?? [];
      list.push(raw);
      byService.set(sid, list);
    }
  }

  for (const id of serviceIds) {
    const list = byService.get(id) ?? [];
    if (list.length === 0) {
      out.set(id, { total: null, complete: false, note: "Aucune vente enregistrée" });
      continue;
    }

    let sum = 0;
    let anyTicket = false;
    let anyMenu = false;
    let anyMissingValuation = false;
    let countedLines = 0;

    for (const raw of list) {
      const qty = Number(raw.qty);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      countedLines += 1;
      const lt = raw.line_total_ht == null ? null : Number(raw.line_total_ht);
      const sp =
        raw.dishes?.selling_price_ht == null ? null : Number(raw.dishes.selling_price_ht);

      if (lt != null && Number.isFinite(lt) && lt > 0) {
        sum = roundMoney(sum + lt);
        anyTicket = true;
      } else if (sp != null && Number.isFinite(sp) && sp > 0) {
        sum = roundMoney(sum + qty * sp);
        anyMenu = true;
      } else {
        anyMissingValuation = true;
      }
    }

    const complete = countedLines > 0 && !anyMissingValuation;

    const note = !complete
      ? "CA incomplet : renseignez le prix sur la fiche plat et/ou line_total_ht sur la vente"
      : anyTicket && anyMenu
        ? "Mixte (montants ticket + prix carte)"
        : anyTicket
          ? "Montants ticket (ligne)"
          : "Prix carte (fiche plat)";

    out.set(id, {
      total: complete ? (sum > 0 ? sum : null) : null,
      complete,
      note,
    });
  }

  return out;
}

export async function getRealizedMarginRowsForServices(
  restaurantId: string,
  services: { id: string; service_date: string; service_type: string }[]
): Promise<RealizedServiceMarginRow[]> {
  const ids = services.map((s) => s.id);
  const [fifoMap, revMap, theoMap] = await Promise.all([
    fifoCostByServiceId(restaurantId, ids),
    revenueByServiceId(restaurantId, ids),
    theoreticalCostByServiceId(restaurantId, ids),
  ]);

  const rows: RealizedServiceMarginRow[] = [];

  for (const s of services) {
    const fifo = fifoMap.get(s.id) ?? { cost: 0, hasUnknown: false };
    const rev = revMap.get(s.id) ?? { total: null, complete: false, note: "—" };
    const theo = theoMap.get(s.id) ?? { cost: 0, complete: false };

    const revenueHt = rev.total != null && rev.total > 0 ? rev.total : null;

    // Coût retenu : le réel quand les lots sont valorisés, sinon le théorique.
    // Sans ce repli, un restaurant qui n'a pas encore saisi ses factures verrait
    // une marge de 100 %, ce qui est plus trompeur qu'une estimation assumée.
    let costHt = fifo.cost;
    let estimatedCostHt = 0;
    let costBasis: MarginCostBasis = "invoiced";

    if (fifo.cost <= 0 && theo.cost > 0) {
      costHt = theo.cost;
      estimatedCostHt = theo.cost;
      costBasis = "estimated";
    } else if (fifo.hasUnknown && theo.cost > fifo.cost) {
      // Une partie des sorties n'avait pas de coût lot : on complète avec le théorique.
      estimatedCostHt = roundMoney(theo.cost - fifo.cost);
      costHt = theo.cost;
      costBasis = "mixed";
    }

    // La marge reste calculable même sur une base estimée : c'est le sens de la demande.
    const canMargin = rev.complete && revenueHt != null && revenueHt > 0 && costHt > 0;

    let marginHt: number | null = null;
    let marginPct: number | null = null;
    if (canMargin && revenueHt != null) {
      marginHt = roundMoney(revenueHt - costHt);
      marginPct = revenueHt > 0 ? roundPct((marginHt / revenueHt) * 100) : null;
    }

    rows.push({
      serviceId: s.id,
      serviceDate: s.service_date,
      serviceType: s.service_type,
      revenueHt,
      revenueComplete: rev.complete,
      revenueNote: rev.note,
      fifoCostHt: fifo.cost,
      fifoHasUnknownCost: fifo.hasUnknown,
      costHt,
      costBasis,
      estimatedCostHt,
      marginHt,
      marginPct,
    });
  }

  return rows;
}

/** Période par défaut : 30 derniers jours (dates UTC). */
export function defaultMarginDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function parseMarginDateParam(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}
