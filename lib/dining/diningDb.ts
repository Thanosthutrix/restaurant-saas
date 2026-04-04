import { supabaseServer } from "@/lib/supabaseServer";
import { toNumber } from "@/lib/utils/safeNumeric";

export type DiningTableRow = {
  id: string;
  restaurant_id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export type DiningOrderRow = {
  id: string;
  restaurant_id: string;
  /** Null si ticket comptoir (`counter_ticket_label` renseigné). */
  dining_table_id: string | null;
  /** Libellé ticket comptoir (nom, etc.) ; null si commande table. */
  counter_ticket_label: string | null;
  status: string;
  service_id: string | null;
  notes: string | null;
  created_at: string;
  settled_at: string | null;
};

export type DiningOrderLineRow = {
  id: string;
  dining_order_id: string;
  dish_id: string;
  qty: unknown;
};

export async function listDiningTables(
  restaurantId: string
): Promise<{ data: DiningTableRow[]; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dining_tables")
    .select("id, restaurant_id, label, sort_order, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as DiningTableRow[], error: null };
}

export async function listAllDiningTablesForAdmin(
  restaurantId: string
): Promise<{ data: DiningTableRow[]; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dining_tables")
    .select("id, restaurant_id, label, sort_order, is_active")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as DiningTableRow[], error: null };
}

/** Commandes ouvertes pour le restaurant (une par table max). */
export async function listOpenDiningOrders(
  restaurantId: string
): Promise<{ data: DiningOrderRow[]; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dining_orders")
    .select(
      "id, restaurant_id, dining_table_id, counter_ticket_label, status, service_id, notes, created_at, settled_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "open");

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as DiningOrderRow[], error: null };
}

export async function ensureOpenDiningOrder(
  restaurantId: string,
  diningTableId: string
): Promise<{ orderId: string | null; error: Error | null }> {
  const { data: existing, error: exErr } = await supabaseServer
    .from("dining_orders")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("dining_table_id", diningTableId)
    .eq("status", "open")
    .maybeSingle();

  if (exErr) return { orderId: null, error: new Error(exErr.message) };
  if (existing) return { orderId: (existing as { id: string }).id, error: null };

  const { data: created, error: insErr } = await supabaseServer
    .from("dining_orders")
    .insert({
      restaurant_id: restaurantId,
      dining_table_id: diningTableId,
      status: "open",
    })
    .select("id")
    .single();

  if (insErr) return { orderId: null, error: new Error(insErr.message) };
  return { orderId: (created as { id: string }).id, error: null };
}

export async function createOpenCounterTicketOrder(
  restaurantId: string,
  ticketLabel: string
): Promise<{ orderId: string | null; error: Error | null }> {
  const label = ticketLabel.trim();
  if (!label) return { orderId: null, error: new Error("Libellé du ticket vide.") };

  const { data: created, error: insErr } = await supabaseServer
    .from("dining_orders")
    .insert({
      restaurant_id: restaurantId,
      dining_table_id: null,
      counter_ticket_label: label,
      status: "open",
    })
    .select("id")
    .single();

  if (insErr) return { orderId: null, error: new Error(insErr.message) };
  return { orderId: (created as { id: string }).id, error: null };
}

export type OpenOrderCaisseRow = {
  orderId: string;
  kind: "table" | "counter";
  label: string;
  totalTtc: number;
  lineCount: number;
  createdAt: string;
};

/** Commandes ouvertes pour la caisse (totaux et libellés table / comptoir). */
export async function listOpenOrdersForCaisse(
  restaurantId: string
): Promise<{ data: OpenOrderCaisseRow[]; error: Error | null }> {
  const { data: orders, error: oErr } = await listOpenDiningOrders(restaurantId);
  if (oErr) return { data: [], error: oErr };

  const tableIds = [
    ...new Set(
      orders
        .map((o) => o.dining_table_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  let labelById = new Map<string, string>();
  if (tableIds.length > 0) {
    const { data: tables, error: tErr } = await supabaseServer
      .from("dining_tables")
      .select("id, label")
      .in("id", tableIds);
    if (tErr) return { data: [], error: new Error(tErr.message) };
    labelById = new Map(
      (tables ?? []).map((t) => [(t as { id: string }).id, (t as { label: string }).label])
    );
  }

  const rows: OpenOrderCaisseRow[] = [];

  for (const o of orders) {
    const linesRes = await getDiningOrderLines(o.id, restaurantId);
    if (linesRes.error) return { data: [], error: linesRes.error };

    const counterLabel = o.counter_ticket_label?.trim();
    const isCounter = Boolean(counterLabel);
    const kind: "table" | "counter" = isCounter ? "counter" : "table";
    const label = isCounter
      ? counterLabel!
      : o.dining_table_id
        ? labelById.get(o.dining_table_id) ?? "—"
        : "—";

    rows.push({
      orderId: o.id,
      kind,
      label,
      totalTtc: orderTotalTtc(linesRes.data),
      lineCount: linesRes.data.length,
      createdAt: o.created_at,
    });
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { data: rows, error: null };
}

export async function getDiningTable(
  tableId: string,
  restaurantId: string
): Promise<{ data: DiningTableRow | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dining_tables")
    .select("id, restaurant_id, label, sort_order, is_active")
    .eq("id", tableId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as DiningTableRow | null, error: null };
}

export async function getDiningOrder(
  orderId: string,
  restaurantId: string
): Promise<{ data: DiningOrderRow | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dining_orders")
    .select(
      "id, restaurant_id, dining_table_id, counter_ticket_label, status, service_id, notes, created_at, settled_at"
    )
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as DiningOrderRow | null, error: null };
}

type DishJoinRow = {
  name: string;
  selling_price_ttc: unknown;
  selling_vat_rate_pct: unknown;
};

export type LineWithDish = DiningOrderLineRow & {
  /** PostgREST renvoie un objet pour la FK ; certains clients peuvent renvoyer un tableau. */
  dishes: DishJoinRow | DishJoinRow[] | null;
};

function dishFromJoin(line: LineWithDish): DishJoinRow | null {
  const d = line.dishes;
  if (!d) return null;
  if (Array.isArray(d)) return d[0] ?? null;
  return d;
}

export async function getDiningOrderLines(
  orderId: string,
  restaurantId: string
): Promise<{ data: LineWithDish[]; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dining_order_lines")
    .select("id, dining_order_id, dish_id, qty, dishes(name, selling_price_ttc, selling_vat_rate_pct)")
    .eq("dining_order_id", orderId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as unknown as LineWithDish[];
  return { data: rows, error: null };
}

export function lineTtc(line: LineWithDish): number {
  const dish = dishFromJoin(line);
  const q = toNumber(line.qty);
  const raw = dish?.selling_price_ttc;
  const ttc = raw == null || raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(ttc) || ttc <= 0 || !Number.isFinite(q)) return 0;
  return Math.round(q * ttc * 100) / 100;
}

export function orderTotalTtc(lines: LineWithDish[]): number {
  let s = 0;
  for (const l of lines) s += lineTtc(l);
  return Math.round(s * 100) / 100;
}

export type SettledPaymentRow = {
  id: string;
  dining_order_id: string;
  payment_method: string;
  amount_ttc: unknown;
  created_at: string;
};

export type SettledOrderSummary = {
  order: DiningOrderRow;
  table_label: string;
  payment: SettledPaymentRow | null;
};

function parisCalendarYmd(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Commandes réglées aujourd’hui (calendrier Europe/Paris) pour la caisse. */
export async function listSettledOrdersToday(
  restaurantId: string
): Promise<{ data: SettledOrderSummary[]; error: Error | null }> {
  const todayParis = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: orders, error: oErr } = await supabaseServer
    .from("dining_orders")
    .select(
      "id, restaurant_id, dining_table_id, counter_ticket_label, status, service_id, notes, created_at, settled_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "settled")
    .not("settled_at", "is", null)
    .order("settled_at", { ascending: false })
    .limit(150);

  if (oErr) return { data: [], error: new Error(oErr.message) };
  const list = (orders ?? []).filter((o) => {
    const row = o as DiningOrderRow;
    return parisCalendarYmd(row.settled_at) === todayParis;
  }) as DiningOrderRow[];
  if (list.length === 0) return { data: [], error: null };

  const tableIds = [
    ...new Set(
      list
        .map((o) => o.dining_table_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const { data: tables } =
    tableIds.length > 0
      ? await supabaseServer.from("dining_tables").select("id, label").in("id", tableIds)
      : { data: [] as { id: string; label: string }[] };
  const labelById = new Map((tables ?? []).map((t) => [(t as { id: string }).id, (t as { label: string }).label]));

  const orderIds = list.map((o) => o.id);
  const { data: pays } = await supabaseServer
    .from("dining_order_payments")
    .select("id, dining_order_id, payment_method, amount_ttc, created_at")
    .eq("restaurant_id", restaurantId)
    .in("dining_order_id", orderIds);

  const payByOrder = new Map<string, SettledPaymentRow>();
  for (const p of pays ?? []) {
    const row = p as SettledPaymentRow;
    payByOrder.set(row.dining_order_id, row);
  }

  const out: SettledOrderSummary[] = list.map((order) => {
    const counter = order.counter_ticket_label?.trim();
    const tableLabel = counter
      ? `Comptoir · ${counter}`
      : order.dining_table_id
        ? labelById.get(order.dining_table_id) ?? "—"
        : "—";
    return {
      order,
      table_label: tableLabel,
      payment: payByOrder.get(order.id) ?? null,
    };
  });

  return { data: out, error: null };
}
