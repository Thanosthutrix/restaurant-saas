import "server-only";

import {
  dishFromJoin,
  listOpenDiningOrdersWithCustomerNames,
  type LineWithDish,
} from "./diningDb";
import {
  diningOrderGuestDisplayName,
  diningTableTicketTitle,
} from "./ticketLabel";
import { supabaseServer } from "@/lib/supabaseServer";

export type KitchenPassLine = {
  id: string;
  dishName: string;
  qty: number;
  isPrepared: boolean;
  createdAt: string;
};

export type KitchenPassTicket = {
  orderId: string;
  label: string;
  pendingLines: KitchenPassLine[];
  oldestPendingAt: string | null;
};

export type KitchenPassQueue = {
  tickets: KitchenPassTicket[];
  pendingLineCount: number;
};

function orderLabel(params: {
  counterLabel: string | null;
  tableLabel: string | null;
  customerName: string | null;
  guestNotes: string | null;
}): string {
  if (params.counterLabel) {
    return params.customerName?.trim() || params.counterLabel;
  }
  return diningTableTicketTitle(
    params.tableLabel ?? "—",
    diningOrderGuestDisplayName(params.customerName, params.guestNotes)
  );
}

/** Bons cuisine : lignes non prêtes des commandes ouvertes, groupées par ticket. */
export async function loadKitchenPassQueue(restaurantId: string): Promise<{
  data: KitchenPassQueue;
  error: Error | null;
}> {
  const { data: openBundle, error: oErr } = await listOpenDiningOrdersWithCustomerNames(restaurantId);
  if (oErr) return { data: { tickets: [], pendingLineCount: 0 }, error: oErr };

  const orders = openBundle.orders;
  if (orders.length === 0) {
    return { data: { tickets: [], pendingLineCount: 0 }, error: null };
  }

  const orderIds = orders.map((o) => o.id);
  const tableIds = [
    ...new Set(
      orders
        .map((o) => o.dining_table_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const [tablesRes, linesRes] = await Promise.all([
    tableIds.length > 0
      ? supabaseServer.from("dining_tables").select("id, label").in("id", tableIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[], error: null }),
    supabaseServer
      .from("dining_order_lines")
      .select(
        "id, dining_order_id, dish_id, qty, is_prepared, created_at, dishes(name, selling_price_ttc, selling_vat_rate_pct)"
      )
      .eq("restaurant_id", restaurantId)
      .in("dining_order_id", orderIds)
      .eq("is_prepared", false)
      .order("created_at", { ascending: true }),
  ]);

  if (tablesRes.error) {
    return { data: { tickets: [], pendingLineCount: 0 }, error: new Error(tablesRes.error.message) };
  }
  if (linesRes.error) {
    return { data: { tickets: [], pendingLineCount: 0 }, error: new Error(linesRes.error.message) };
  }

  const labelByTableId = new Map(
    (tablesRes.data ?? []).map((t) => [(t as { id: string }).id, (t as { label: string }).label])
  );

  const linesByOrder = new Map<string, KitchenPassLine[]>();
  for (const raw of (linesRes.data ?? []) as unknown as (LineWithDish & { created_at: string })[]) {
    const dish = dishFromJoin(raw);
    const arr = linesByOrder.get(raw.dining_order_id) ?? [];
    arr.push({
      id: raw.id,
      dishName: dish?.name ?? "Plat",
      qty: Number(raw.qty),
      isPrepared: Boolean(raw.is_prepared),
      createdAt: raw.created_at,
    });
    linesByOrder.set(raw.dining_order_id, arr);
  }

  const tickets: KitchenPassTicket[] = [];
  let pendingLineCount = 0;

  for (const order of orders) {
    const pendingLines = linesByOrder.get(order.id) ?? [];
    if (pendingLines.length === 0) continue;

    pendingLineCount += pendingLines.length;
    const tableLabel = order.dining_table_id
      ? labelByTableId.get(order.dining_table_id) ?? null
      : null;
    const customerName = order.customer_id
      ? openBundle.customerNameById.get(order.customer_id) ?? null
      : null;

    tickets.push({
      orderId: order.id,
      label: orderLabel({
        counterLabel: order.counter_ticket_label,
        tableLabel,
        customerName,
        guestNotes: order.notes,
      }),
      pendingLines,
      oldestPendingAt: pendingLines[0]?.createdAt ?? null,
    });
  }

  tickets.sort((a, b) => {
    const ta = a.oldestPendingAt ? new Date(a.oldestPendingAt).getTime() : 0;
    const tb = b.oldestPendingAt ? new Date(b.oldestPendingAt).getTime() : 0;
    return ta - tb;
  });

  return { data: { tickets, pendingLineCount }, error: null };
}
