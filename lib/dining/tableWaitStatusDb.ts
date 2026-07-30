import "server-only";

import { listOpenDiningOrdersWithCustomerNames, getDiningOrderLines } from "./diningDb";
import { mapLinesToClientsEnriched } from "./diningOrderViewData";
import {
  DEFAULT_DINING_WAIT_THRESHOLDS,
  parseDiningWaitThresholds,
  type DiningWaitThresholds,
} from "./diningWaitSettings";
import { buildTableServiceStatusMap, type TableServiceStatus } from "./tableWaitStatus";
import { supabaseServer } from "@/lib/supabaseServer";

export type TableServiceStatusSnapshot = {
  thresholds: DiningWaitThresholds;
  byTableId: Record<string, TableServiceStatus>;
};

export async function loadDiningWaitThresholds(restaurantId: string): Promise<DiningWaitThresholds> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("dining_wait_green_minutes, dining_wait_orange_minutes, dining_wait_red_minutes")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) return DEFAULT_DINING_WAIT_THRESHOLDS;
  return parseDiningWaitThresholds(data);
}

export async function loadTableServiceStatusSnapshot(
  restaurantId: string
): Promise<{ data: TableServiceStatusSnapshot; error: Error | null }> {
  const thresholds = await loadDiningWaitThresholds(restaurantId);

  const { data: openBundle, error: oErr } = await listOpenDiningOrdersWithCustomerNames(restaurantId);
  if (oErr) return { data: { thresholds, byTableId: {} }, error: oErr };

  const tableOrders = openBundle.orders.filter((o) => o.dining_table_id != null);
  if (tableOrders.length === 0) {
    return { data: { thresholds, byTableId: {} }, error: null };
  }

  const orderIds = tableOrders.map((o) => o.id);

  const ordersRes = await supabaseServer
    .from("dining_orders")
    .select(
      "id, dining_table_id, kitchen_ready_notified_at, kitchen_ready_ack_at, bar_ready_notified_at, bar_ready_ack_at"
    )
    .eq("restaurant_id", restaurantId)
    .in("id", orderIds);

  if (ordersRes.error) {
    return { data: { thresholds, byTableId: {} }, error: new Error(ordersRes.error.message) };
  }

  const linesByOrderId = new Map<string, Awaited<ReturnType<typeof mapLinesToClientsEnriched>>>();
  await Promise.all(
    tableOrders.map(async (order) => {
      const { data: lines } = await getDiningOrderLines(order.id, restaurantId);
      const clientLines = await mapLinesToClientsEnriched(restaurantId, lines);
      linesByOrderId.set(order.id, clientLines);
    })
  );

  const statusMap = buildTableServiceStatusMap({
    thresholds,
    linesByOrderId,
    orders: (ordersRes.data ?? []).map((row) => ({
      orderId: (row as { id: string }).id,
      diningTableId: (row as { dining_table_id: string | null }).dining_table_id,
      kitchenReadyNotifiedAt:
        ((row as { kitchen_ready_notified_at?: string | null }).kitchen_ready_notified_at as string | null) ??
        null,
      kitchenReadyAckAt:
        ((row as { kitchen_ready_ack_at?: string | null }).kitchen_ready_ack_at as string | null) ?? null,
      barReadyNotifiedAt:
        ((row as { bar_ready_notified_at?: string | null }).bar_ready_notified_at as string | null) ?? null,
      barReadyAckAt:
        ((row as { bar_ready_ack_at?: string | null }).bar_ready_ack_at as string | null) ?? null,
    })),
  });

  const byTableId = Object.fromEntries(statusMap.entries());
  return { data: { thresholds, byTableId }, error: null };
}

export async function markTableReadySignalsNotified(params: {
  restaurantId: string;
  orderId: string;
  kitchen?: boolean;
  bar?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, string> = {};
  if (params.kitchen) payload.kitchen_ready_notified_at = now;
  if (params.bar) payload.bar_ready_notified_at = now;
  if (Object.keys(payload).length === 0) return;

  await supabaseServer
    .from("dining_orders")
    .update(payload)
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId);
}

export async function acknowledgeTableReadySignals(params: {
  restaurantId: string;
  orderId: string;
  kitchen?: boolean;
  bar?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const payload: Record<string, string> = {};
  if (params.kitchen) payload.kitchen_ready_ack_at = now;
  if (params.bar) payload.bar_ready_ack_at = now;
  if (Object.keys(payload).length === 0) {
    return { ok: false, error: "Rien à acquitter." };
  }

  const { error } = await supabaseServer
    .from("dining_orders")
    .update(payload)
    .eq("id", params.orderId)
    .eq("restaurant_id", params.restaurantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
