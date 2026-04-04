/**
 * Marge réalisée agrégée par plat sur une période : CA des ventes (service_sales dans l’intervalle)
 * vs coût FIFO ventilé par service au prorata du coût matière théorique des lignes vendues.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { computeDishFoodCostHt } from "@/lib/margins/dishMarginAnalysis";
import { fifoCostByServiceId } from "@/lib/margins/realizedServiceMargins";
import { roundMoney } from "@/lib/stock/purchasePriceHistory";

const EPS = 1e-9;

export type RealizedDishMarginRow = {
  dishId: string;
  dishName: string;
  revenueHt: number | null;
  revenueComplete: boolean;
  /** Coût FIFO alloué depuis les services (somme des parts). */
  allocatedFifoCostHt: number;
  /** Au moins un service source avait du volume FIFO sans coût connu. */
  affectedByUnknownFifo: boolean;
  marginHt: number | null;
  marginPct: number | null;
  note: string | null;
};

type SaleLineRaw = {
  service_id: string;
  dish_id: string;
  qty: unknown;
  line_total_ht: unknown;
  dishes: { name: string; selling_price_ht: unknown } | null;
};

function roundPct(n: number): number {
  return Math.round(n * 10) / 10;
}

function lineRevenueHt(raw: SaleLineRaw): { value: number | null; ok: boolean } {
  const qty = Number(raw.qty);
  if (!Number.isFinite(qty) || qty <= 0) return { value: null, ok: false };

  const lt = raw.line_total_ht == null ? null : Number(raw.line_total_ht);
  const sp =
    raw.dishes?.selling_price_ht == null ? null : Number(raw.dishes.selling_price_ht);

  if (lt != null && Number.isFinite(lt) && lt > 0) {
    return { value: roundMoney(lt), ok: true };
  }
  if (sp != null && Number.isFinite(sp) && sp > 0) {
    return { value: roundMoney(qty * sp), ok: true };
  }
  return { value: null, ok: false };
}

export async function getRealizedMarginRowsByDish(
  restaurantId: string,
  serviceIds: string[]
): Promise<RealizedDishMarginRow[]> {
  if (serviceIds.length === 0) return [];

  const { data: sales, error } = await supabaseServer
    .from("service_sales")
    .select("service_id, dish_id, qty, line_total_ht, dishes(name, selling_price_ht)")
    .eq("restaurant_id", restaurantId)
    .in("service_id", serviceIds);

  if (error || !sales?.length) return [];

  const lines = sales as unknown as SaleLineRaw[];
  const byService = new Map<string, SaleLineRaw[]>();
  for (const row of lines) {
    const sid = row.service_id;
    const list = byService.get(sid) ?? [];
    list.push(row);
    byService.set(sid, list);
  }

  const dishIds = [...new Set(lines.map((l) => l.dish_id))];
  const foodCostByDish = new Map<string, { unit: number; complete: boolean }>();
  await Promise.all(
    dishIds.map(async (did) => {
      const r = await computeDishFoodCostHt(restaurantId, did);
      foodCostByDish.set(did, {
        unit: r.costIsComplete ? r.foodCostHt : 0,
        complete: r.costIsComplete && !r.errorMessage && r.foodCostHt >= 0,
      });
    })
  );

  const fifoMap = await fifoCostByServiceId(restaurantId, serviceIds);

  type Acc = {
    dishName: string;
    revenueSum: number;
    revenueComplete: boolean;
    fifoAllocated: number;
    unknownFifo: boolean;
    theoIncomplete: boolean;
  };
  const accByDish = new Map<string, Acc>();

  function ensureAcc(dishId: string, name: string): Acc {
    let a = accByDish.get(dishId);
    if (!a) {
      a = {
        dishName: name,
        revenueSum: 0,
        revenueComplete: true,
        fifoAllocated: 0,
        unknownFifo: false,
        theoIncomplete: false,
      };
      accByDish.set(dishId, a);
    }
    return a;
  }

  for (const serviceId of serviceIds) {
    const list = byService.get(serviceId) ?? [];
    if (list.length === 0) continue;

    const fifo = fifoMap.get(serviceId) ?? { cost: 0, hasUnknown: false };
    const fifoTotal = fifo.cost;

    type RowMeta = {
      dishId: string;
      dishName: string;
      qty: number;
      rev: number | null;
      revOk: boolean;
      /** Poids pour ventiler le FIFO (coût théorique portion × qté, sinon CA, sinon qté). */
      allocWeight: number;
      theoOk: boolean;
    };

    const metas: RowMeta[] = [];
    let sumW = 0;

    for (const raw of list) {
      const dishId = raw.dish_id;
      const dishName = raw.dishes?.name?.trim() || "Plat";
      const qty = Number(raw.qty);
      const { value: rev, ok: revOk } = lineRevenueHt(raw);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const fc = foodCostByDish.get(dishId) ?? { unit: 0, complete: false };
      const theoOk = fc.complete && fc.unit > EPS;
      let allocWeight = 0;
      if (theoOk) {
        allocWeight = fc.unit * qty;
      } else if (revOk && rev != null && rev > EPS) {
        allocWeight = rev;
      } else {
        allocWeight = qty;
      }
      sumW += allocWeight;

      metas.push({
        dishId,
        dishName,
        qty,
        rev,
        revOk,
        allocWeight,
        theoOk,
      });
    }

    if (metas.length === 0) continue;

    if (fifoTotal <= EPS) {
      for (const m of metas) {
        const a = ensureAcc(m.dishId, m.dishName);
        a.dishName = m.dishName;
        if (m.revOk && m.rev != null) a.revenueSum = roundMoney(a.revenueSum + m.rev);
        if (!m.revOk) a.revenueComplete = false;
        if (!m.theoOk) a.theoIncomplete = true;
        if (fifo.hasUnknown) a.unknownFifo = true;
      }
      continue;
    }

    if (sumW > EPS) {
      for (const m of metas) {
        const alloc = roundMoney(fifoTotal * (m.allocWeight / sumW));
        const a = ensureAcc(m.dishId, m.dishName);
        a.dishName = m.dishName;
        if (m.revOk && m.rev != null) a.revenueSum = roundMoney(a.revenueSum + m.rev);
        if (!m.revOk) a.revenueComplete = false;
        if (!m.theoOk) a.theoIncomplete = true;
        a.fifoAllocated = roundMoney(a.fifoAllocated + alloc);
        if (fifo.hasUnknown) a.unknownFifo = true;
      }
      continue;
    }

    /* sumW == 0 : parts égales */
    const n = metas.length;
    const per = roundMoney(fifoTotal / n);
    for (const m of metas) {
      const a = ensureAcc(m.dishId, m.dishName);
      a.dishName = m.dishName;
      if (m.revOk && m.rev != null) a.revenueSum = roundMoney(a.revenueSum + m.rev);
      if (!m.revOk) a.revenueComplete = false;
      a.theoIncomplete = true;
      a.fifoAllocated = roundMoney(a.fifoAllocated + per);
      if (fifo.hasUnknown) a.unknownFifo = true;
    }
  }

  const rows: RealizedDishMarginRow[] = [];

  for (const [dishId, a] of accByDish) {
    const revenueHt = a.revenueSum > EPS ? a.revenueSum : null;
    const canMargin =
      a.revenueComplete && revenueHt != null && revenueHt > EPS && !a.unknownFifo;

    let marginHt: number | null = null;
    let marginPct: number | null = null;
    if (canMargin && revenueHt != null) {
      marginHt = roundMoney(revenueHt - a.fifoAllocated);
      marginPct = revenueHt > 0 ? roundPct((marginHt / revenueHt) * 100) : null;
    }

    const parts: string[] = [];
    if (a.unknownFifo) {
      parts.push("FIFO partiel sur au moins un service (coût lot inconnu) — marge non affichée");
    }
    if (a.theoIncomplete) {
      parts.push("ventilation FIFO au prorata CA ou quantité faute de coût théorique complet");
    }
    if (!a.revenueComplete) {
      parts.push("CA incomplet sur une ou plusieurs ventes");
    }

    rows.push({
      dishId,
      dishName: a.dishName,
      revenueHt,
      revenueComplete: a.revenueComplete,
      allocatedFifoCostHt: roundMoney(a.fifoAllocated),
      affectedByUnknownFifo: a.unknownFifo,
      marginHt,
      marginPct,
      note: parts.length ? parts.join(" · ") : null,
    });
  }

  rows.sort((x, y) => {
    const rx = x.revenueHt ?? 0;
    const ry = y.revenueHt ?? 0;
    if (ry !== rx) return ry - rx;
    return x.dishName.localeCompare(y.dishName, "fr");
  });

  return rows;
}
