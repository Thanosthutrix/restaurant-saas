/**
 * CA HT et quantités vendues agrégés par date de service (jour calendaire).
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { roundMoney } from "@/lib/stock/purchasePriceHistory";

type SaleRow = {
  service_id: string;
  qty: unknown;
  line_total_ht: unknown;
  dishes: { selling_price_ht: unknown } | null;
};

function lineRevenueHt(raw: SaleRow): { value: number | null; ok: boolean } {
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

export type DailySalesAggregate = {
  revenueHt: number | null;
  revenueComplete: boolean;
  qtySold: number;
  serviceCount: number;
};

export async function getDailySalesAggregatesByServiceDate(
  restaurantId: string,
  from: string,
  to: string
): Promise<Map<string, DailySalesAggregate>> {
  const byDate = new Map<string, DailySalesAggregate>();

  const { data: services, error: sErr } = await supabaseServer
    .from("services")
    .select("id, service_date")
    .eq("restaurant_id", restaurantId)
    .gte("service_date", from)
    .lte("service_date", to);

  if (sErr || !services?.length) return byDate;

  const serviceToDate = new Map<string, string>();
  const serviceIds: string[] = [];
  const countByDate = new Map<string, number>();
  for (const s of services) {
    const id = (s as { id: string }).id;
    const d = String((s as { service_date: string }).service_date).slice(0, 10);
    serviceToDate.set(id, d);
    serviceIds.push(id);
    countByDate.set(d, (countByDate.get(d) ?? 0) + 1);
  }

  const { data: sales, error: salesErr } = await supabaseServer
    .from("service_sales")
    .select("service_id, qty, line_total_ht, dishes(selling_price_ht)")
    .eq("restaurant_id", restaurantId)
    .in("service_id", serviceIds);

  if (salesErr || !sales?.length) {
    for (const d of new Set(serviceToDate.values())) {
      byDate.set(d, {
        revenueHt: null,
        revenueComplete: true,
        qtySold: 0,
        serviceCount: countByDate.get(d) ?? 0,
      });
    }
    return byDate;
  }

  const agg = new Map<string, { sum: number; complete: boolean; qty: number }>();

  for (const d of new Set(serviceToDate.values())) {
    agg.set(d, { sum: 0, complete: true, qty: 0 });
  }

  for (const raw of sales as unknown as SaleRow[]) {
    const date = serviceToDate.get(raw.service_id);
    if (!date) continue;
    const bucket = agg.get(date);
    if (!bucket) continue;

    const qty = Number(raw.qty);
    if (Number.isFinite(qty) && qty > 0) bucket.qty += qty;

    const { value, ok } = lineRevenueHt(raw);
    if (ok && value != null) {
      bucket.sum = roundMoney(bucket.sum + value);
    } else if (Number.isFinite(qty) && qty > 0) {
      bucket.complete = false;
    }
  }

  for (const [date, bucket] of agg) {
    byDate.set(date, {
      revenueHt: bucket.complete && bucket.sum > 0 ? bucket.sum : bucket.complete ? bucket.sum : null,
      revenueComplete: bucket.complete,
      qtySold: bucket.qty,
      serviceCount: countByDate.get(date) ?? 0,
    });
  }

  return byDate;
}
