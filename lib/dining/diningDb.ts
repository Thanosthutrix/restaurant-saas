import { supabaseServer } from "@/lib/supabaseServer";
import { toNumber } from "@/lib/utils/safeNumeric";
import { diningTableTicketLineLabel, diningTableTicketTitle } from "@/lib/dining/ticketLabel";
import {
  lineGrossFromUnit,
  lineNetAfterDiscount,
  parseDiningDiscountKind,
} from "@/lib/dining/lineDiscount";

export type { DiningDiscountKind } from "@/lib/dining/lineDiscount";

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
  /** Fiche client (Base clients), optionnel. */
  customer_id: string | null;
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
  /** Cuisine : la ligne est prête (plat terminé). */
  is_prepared?: boolean;
  discount_kind?: string;
  discount_value?: unknown;
};

/** Noms affichables pour lier un ticket comptoir à la fiche client (sans requête par ligne). */
export async function mapCustomerDisplayNames(
  restaurantId: string,
  customerIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(customerIds.filter((id): id is string => typeof id === "string" && id.length > 0)),
  ];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseServer
    .from("restaurant_customers")
    .select("id, display_name")
    .eq("restaurant_id", restaurantId)
    .in("id", ids);
  if (error || !data) return new Map();
  const m = new Map<string, string>();
  for (const row of data as { id: string; display_name: string }[]) {
    const d = String(row.display_name ?? "").trim();
    if (d) m.set(row.id, d);
  }
  return m;
}

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
      "id, restaurant_id, dining_table_id, counter_ticket_label, customer_id, status, service_id, notes, created_at, settled_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "open");

  if (error) return { data: [], error: new Error(error.message) };
  return { data: (data ?? []) as DiningOrderRow[], error: null };
}

export async function listOpenDiningOrdersWithCustomerNames(
  restaurantId: string
): Promise<{ data: { orders: DiningOrderRow[]; customerNameById: Map<string, string> }; error: Error | null }> {
  const { data: orders, error } = await listOpenDiningOrders(restaurantId);
  if (error) return { data: { orders: [], customerNameById: new Map() }, error };
  const customerNameById = await mapCustomerDisplayNames(
    restaurantId,
    orders.map((o) => o.customer_id)
  );
  return { data: { orders, customerNameById }, error: null };
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
  ticketLabel: string,
  customerId?: string | null
): Promise<{ orderId: string | null; error: Error | null }> {
  const label = ticketLabel.trim();
  if (!label) return { orderId: null, error: new Error("Libellé du ticket vide.") };

  let validCustomer: string | null = null;
  /** Avec fiche client : le ticket affiché = nom officiel de la fiche. */
  let counterLabel = label;
  if (customerId) {
    const { data: cust, error: cErr } = await supabaseServer
      .from("restaurant_customers")
      .select("id, display_name")
      .eq("id", customerId)
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .maybeSingle();
    if (cErr) return { orderId: null, error: new Error(cErr.message) };
    if (cust) {
      validCustomer = (cust as { id: string }).id;
      const dn = String((cust as { display_name: string }).display_name ?? "").trim();
      if (dn) counterLabel = dn;
    }
  }

  const insert: Record<string, unknown> = {
    restaurant_id: restaurantId,
    dining_table_id: null,
    counter_ticket_label: counterLabel,
    status: "open",
  };
  if (validCustomer) insert.customer_id = validCustomer;

  const { data: created, error: insErr } = await supabaseServer
    .from("dining_orders")
    .insert(insert)
    .select("id")
    .single();

  if (insErr) return { orderId: null, error: new Error(insErr.message) };
  return { orderId: (created as { id: string }).id, error: null };
}

/**
 * Associe (ou retire) une fiche client sur une commande ouverte.
 */
export async function setDiningOrderCustomerId(
  restaurantId: string,
  orderId: string,
  customerId: string | null
): Promise<{ error: Error | null }> {
  const { data: orderRow, error: oErr } = await supabaseServer
    .from("dining_orders")
    .select("dining_table_id, counter_ticket_label")
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (oErr) return { error: new Error(oErr.message) };
  if (!orderRow) return { error: new Error("Commande introuvable.") };

  const isCounterTicket =
    (orderRow as { dining_table_id: string | null }).dining_table_id == null &&
    String((orderRow as { counter_ticket_label: string | null }).counter_ticket_label ?? "").trim() !== "";

  if (customerId) {
    const { data: cust, error: cErr } = await supabaseServer
      .from("restaurant_customers")
      .select("id, display_name")
      .eq("id", customerId)
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .maybeSingle();
    if (cErr) return { error: new Error(cErr.message) };
    if (!cust) return { error: new Error("Client introuvable ou inactif.") };

    const displayName = String((cust as { display_name: string }).display_name ?? "").trim();
    const patch: Record<string, unknown> = { customer_id: customerId };
    if (isCounterTicket && displayName) {
      patch.counter_ticket_label = displayName;
    }

    const { error } = await supabaseServer
      .from("dining_orders")
      .update(patch)
      .eq("id", orderId)
      .eq("restaurant_id", restaurantId);
    if (error) return { error: new Error(error.message) };
    return { error: null };
  }

  const { error } = await supabaseServer
    .from("dining_orders")
    .update({ customer_id: null })
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
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
  if (orders.length === 0) return { data: [], error: null };

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

  const customerNameById = await mapCustomerDisplayNames(
    restaurantId,
    orders.map((o) => o.customer_id)
  );

  const orderIds = orders.map((o) => o.id);
  const linesByOrderId = new Map<string, LineWithDish[]>();
  const { data: rawLines, error: linesErr } = await supabaseServer
    .from("dining_order_lines")
    .select(
      "id, dining_order_id, dish_id, qty, is_prepared, discount_kind, discount_value, dishes(name, selling_price_ttc, selling_vat_rate_pct)"
    )
    .eq("restaurant_id", restaurantId)
    .in("dining_order_id", orderIds)
    .order("created_at", { ascending: true });
  if (linesErr) return { data: [], error: new Error(linesErr.message) };
  for (const line of (rawLines ?? []) as unknown as LineWithDish[]) {
    const arr = linesByOrderId.get(line.dining_order_id) ?? [];
    arr.push(line);
    linesByOrderId.set(line.dining_order_id, arr);
  }

  const rows: OpenOrderCaisseRow[] = [];
  for (const o of orders) {
    const lines = linesByOrderId.get(o.id) ?? [];

    const counterLabel = o.counter_ticket_label?.trim();
    const isCounter = Boolean(counterLabel);
    const kind: "table" | "counter" = isCounter ? "counter" : "table";
    const fromClient =
      isCounter && o.customer_id ? customerNameById.get(o.customer_id) : undefined;
    const tableLbl = o.dining_table_id ? labelById.get(o.dining_table_id) ?? "—" : "—";
    const clientName = o.customer_id ? customerNameById.get(o.customer_id) : undefined;
    const label = isCounter
      ? (fromClient ?? counterLabel) ?? "—"
      : o.dining_table_id
        ? diningTableTicketLineLabel(tableLbl, clientName)
        : "—";

    rows.push({
      orderId: o.id,
      kind,
      label,
      totalTtc: orderTotalTtc(lines),
      lineCount: lines.length,
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
      "id, restaurant_id, dining_table_id, counter_ticket_label, customer_id, status, service_id, notes, created_at, settled_at"
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

export function dishFromJoin(line: LineWithDish): DishJoinRow | null {
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
    .select(
      "id, dining_order_id, dish_id, qty, is_prepared, discount_kind, discount_value, dishes(name, selling_price_ttc, selling_vat_rate_pct)"
    )
    .eq("dining_order_id", orderId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  const rows = (data ?? []) as unknown as LineWithDish[];
  return { data: rows, error: null };
}

export async function getDiningOrderLineById(
  lineId: string,
  restaurantId: string
): Promise<{ data: LineWithDish | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dining_order_lines")
    .select(
      "id, dining_order_id, dish_id, qty, is_prepared, discount_kind, discount_value, dishes(name, selling_price_ttc, selling_vat_rate_pct)"
    )
    .eq("id", lineId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data ?? null) as LineWithDish | null, error: null };
}

/** TTC ligne avant remise (prix catalogue × qté). */
export function lineGrossTtc(line: LineWithDish): number {
  const dish = dishFromJoin(line);
  const q = toNumber(line.qty);
  const raw = dish?.selling_price_ttc;
  const ttc = raw == null || raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(ttc) || ttc <= 0 || !Number.isFinite(q)) return 0;
  return lineGrossFromUnit(q, ttc);
}

/** TTC ligne après remise (utilisé pour totaux et encaissement). */
export function lineTtc(line: LineWithDish): number {
  const gross = lineGrossTtc(line);
  const kind = parseDiningDiscountKind(line.discount_kind);
  const raw = line.discount_value;
  const val = raw == null || raw === "" ? null : Number(raw);
  const discountValue = val != null && Number.isFinite(val) ? val : null;
  return lineNetAfterDiscount(gross, kind, discountValue);
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

export async function getDiningOrderPayment(
  orderId: string,
  restaurantId: string
): Promise<{ data: SettledPaymentRow | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("dining_order_payments")
    .select("id, dining_order_id, payment_method, amount_ttc, created_at")
    .eq("dining_order_id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as SettledPaymentRow | null, error: null };
}

function parisDayUtcBounds(day = new Date()): { startIso: string; endIso: string } {
  const ymd = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(day);
  const noonUtc = new Date(`${ymd}T12:00:00.000Z`);
  const parisParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(noonUtc);
  const hour = Number(parisParts.find((p) => p.type === "hour")?.value ?? "12");
  const minute = Number(parisParts.find((p) => p.type === "minute")?.value ?? "0");
  const second = Number(parisParts.find((p) => p.type === "second")?.value ?? "0");
  const offsetMs = ((hour - 12) * 60 * 60 + minute * 60 + second) * 1000;
  const start = new Date(Date.parse(`${ymd}T00:00:00.000Z`) - offsetMs);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Commandes réglées aujourd’hui (calendrier Europe/Paris) pour la caisse. */
export async function listSettledOrdersToday(
  restaurantId: string
): Promise<{ data: SettledOrderSummary[]; error: Error | null }> {
  const { startIso, endIso } = parisDayUtcBounds();

  const { data: orders, error: oErr } = await supabaseServer
    .from("dining_orders")
    .select(
      "id, restaurant_id, dining_table_id, counter_ticket_label, customer_id, status, service_id, notes, created_at, settled_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "settled")
    .gte("settled_at", startIso)
    .lt("settled_at", endIso)
    .order("settled_at", { ascending: false })
    .limit(120);

  if (oErr) return { data: [], error: new Error(oErr.message) };
  const list = (orders ?? []) as DiningOrderRow[];
  if (list.length === 0) return { data: [], error: null };

  const customerNameById = await mapCustomerDisplayNames(
    restaurantId,
    list.map((o) => o.customer_id)
  );

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
    const fromClient =
      counter && order.customer_id ? customerNameById.get(order.customer_id) : undefined;
    const tableLabel = counter
      ? (fromClient ?? counter)
      : order.dining_table_id
        ? diningTableTicketTitle(
            labelById.get(order.dining_table_id) ?? "—",
            order.customer_id ? customerNameById.get(order.customer_id) : undefined
          )
        : "—";
    return {
      order,
      table_label: tableLabel,
      payment: payByOrder.get(order.id) ?? null,
    };
  });

  return { data: out, error: null };
}
