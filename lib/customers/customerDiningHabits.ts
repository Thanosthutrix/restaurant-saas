import { supabaseServer } from "@/lib/supabaseServer";
import { toNumber } from "@/lib/utils/safeNumeric";

export type CustomerOpenTicketRow = {
  orderId: string;
  label: string;
  createdAt: string;
};

export type CustomerDiningHabitsReport = {
  settledOrdersCount: number;
  openTicketsCount: number;
  /** Commandes ouvertes liées à la fiche (lien direct vers la salle / ticket). */
  openTickets: CustomerOpenTicketRow[];
  totalSpentTtc: number;
  averageTicketTtc: number;
  lastSettledAt: string | null;
  firstSettledAt: string | null;
  favoriteDishes: { name: string; lineCount: number }[];
  paymentMix: { method: string; label: string; count: number }[];
  /** 0 = dimanche … 6 = samedi */
  visitsByWeekday: { weekday: number; label: string; count: number }[];
  preferredWeekdayLabel: string | null;
};

const WD_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const PAY_LABEL: Record<string, string> = {
  card: "Carte bancaire",
  cash: "Espèces",
  cheque: "Chèques",
  other: "Autre",
};

/**
 * Statistiques commandes (tickets réglés) pour une fiche client.
 */
export async function getCustomerDiningHabitsReport(
  restaurantId: string,
  customerId: string
): Promise<{ data: CustomerDiningHabitsReport; error: Error | null }> {
  const empty: CustomerDiningHabitsReport = {
    settledOrdersCount: 0,
    openTicketsCount: 0,
    openTickets: [],
    totalSpentTtc: 0,
    averageTicketTtc: 0,
    lastSettledAt: null,
    firstSettledAt: null,
    favoriteDishes: [],
    paymentMix: [],
    visitsByWeekday: WD_FR.map((label, weekday) => ({ weekday, label, count: 0 })),
    preferredWeekdayLabel: null,
  };

  {
    const { data: openRows, error: openErr } = await supabaseServer
      .from("dining_orders")
      .select("id, created_at, dining_table_id, counter_ticket_label")
      .eq("restaurant_id", restaurantId)
      .eq("customer_id", customerId)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (openErr) return { data: empty, error: new Error(openErr.message) };
    const orders = (openRows ?? []) as {
      id: string;
      created_at: string;
      dining_table_id: string | null;
      counter_ticket_label: string | null;
    }[];

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
      if (tErr) return { data: empty, error: new Error(tErr.message) };
      labelById = new Map(
        (tables ?? []).map((t) => [(t as { id: string }).id, (t as { label: string }).label])
      );
    }

    empty.openTickets = orders.map((o) => {
      const counter = o.counter_ticket_label?.trim();
      const label = counter
        ? counter
        : o.dining_table_id
          ? `Table ${labelById.get(o.dining_table_id) ?? "—"}`
          : "Commande";
      return { orderId: o.id, label, createdAt: o.created_at };
    });
    empty.openTicketsCount = empty.openTickets.length;
  }

  const { data: settled, error: sErr } = await supabaseServer
    .from("dining_orders")
    .select("id, settled_at")
    .eq("restaurant_id", restaurantId)
    .eq("customer_id", customerId)
    .eq("status", "settled")
    .not("settled_at", "is", null)
    .order("settled_at", { ascending: true });

  if (sErr) return { data: empty, error: new Error(sErr.message) };
  const orderList = (settled ?? []) as { id: string; settled_at: string | null }[];
  if (orderList.length === 0) {
    return { data: empty, error: null };
  }

  const orderIds = orderList.map((o) => o.id);
  empty.settledOrdersCount = orderList.length;
  empty.firstSettledAt = orderList[0]?.settled_at ?? null;
  empty.lastSettledAt = orderList[orderList.length - 1]?.settled_at ?? null;

  for (const o of orderList) {
    if (!o.settled_at) continue;
    const d = new Date(o.settled_at);
    if (Number.isNaN(d.getTime())) continue;
    const wd = d.getDay();
    const slot = empty.visitsByWeekday.find((x) => x.weekday === wd);
    if (slot) slot.count += 1;
  }
  const bestWd = empty.visitsByWeekday.reduce((a, b) => (b.count > a.count ? b : a));
  empty.preferredWeekdayLabel = bestWd.count > 0 ? bestWd.label : null;

  const { data: pays, error: pErr } = await supabaseServer
    .from("dining_order_payments")
    .select("dining_order_id, amount_ttc, payment_method")
    .eq("restaurant_id", restaurantId)
    .in("dining_order_id", orderIds);

  if (pErr) return { data: empty, error: new Error(pErr.message) };

  const byMethod = new Map<string, number>();
  let total = 0;
  for (const p of pays ?? []) {
    const row = p as { amount_ttc: unknown; payment_method: string };
    const amt = toNumber(row.amount_ttc);
    if (Number.isFinite(amt) && amt > 0) total += amt;
    const m = row.payment_method === "other" ? "cheque" : row.payment_method;
    byMethod.set(m, (byMethod.get(m) ?? 0) + 1);
  }
  empty.totalSpentTtc = Math.round(total * 100) / 100;
  empty.averageTicketTtc =
    empty.settledOrdersCount > 0
      ? Math.round((empty.totalSpentTtc / empty.settledOrdersCount) * 100) / 100
      : 0;

  empty.paymentMix = [...byMethod.entries()].map(([method, count]) => ({
    method,
    label: PAY_LABEL[method] ?? method,
    count,
  }));

  const { data: lines, error: lErr } = await supabaseServer
    .from("dining_order_lines")
    .select("qty, dishes(name)")
    .eq("restaurant_id", restaurantId)
    .in("dining_order_id", orderIds);

  if (lErr) return { data: empty, error: new Error(lErr.message) };

  const dishQty = new Map<string, number>();
  for (const line of lines ?? []) {
    const l = line as { qty: unknown; dishes: { name: string } | { name: string }[] | null };
    const dish = Array.isArray(l.dishes) ? l.dishes[0] : l.dishes;
    const name = dish?.name?.trim() || "Plat";
    const q = toNumber(l.qty);
    const add = Number.isFinite(q) && q > 0 ? q : 1;
    dishQty.set(name, (dishQty.get(name) ?? 0) + add);
  }

  empty.favoriteDishes = [...dishQty.entries()]
    .map(([name, lineCount]) => ({ name, lineCount }))
    .sort((a, b) => b.lineCount - a.lineCount)
    .slice(0, 6);

  return { data: empty, error: null };
}
