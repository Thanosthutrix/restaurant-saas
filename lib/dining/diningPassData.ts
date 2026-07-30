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
import { mealCourseLabel, resolveMealCourse, type DiningMealCourse } from "./courseTypes";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  kitchenLabelsFromSnapshot,
  parseKitchenModsSnapshot,
} from "./lineModificationLogic";
import { loadDiningWaitThresholds } from "./tableWaitStatusDb";
import {
  waitColorFromSentAt,
  waitColorUrgencyRank,
  type TableWaitColor,
} from "./diningWaitSettings";
import { categoryPathLabel, listRestaurantCategories } from "@/lib/catalog/restaurantCategories";
import { lineGoesToBarPass, lineGoesToKitchenPass } from "./passDestination";

export type DiningPassLine = {
  id: string;
  dishName: string;
  qty: number;
  isPrepared: boolean;
  courseType: DiningMealCourse | null;
  createdAt: string;
  sentAt: string;
  kitchenLabels: string[];
};

export type DiningPassCourseGroup = {
  courseType: DiningMealCourse | null;
  label: string;
  lines: DiningPassLine[];
};

export type DiningPassTicket = {
  orderId: string;
  label: string;
  courseGroups: DiningPassCourseGroup[];
  pendingLines: DiningPassLine[];
  /** Plus ancien envoi serveur (sent_to_kitchen_at) du ticket. */
  oldestSentAt: string | null;
  /** Urgence visuelle (bleu → rouge). */
  waitColor: TableWaitColor;
};

export type DiningPassQueue = {
  tickets: DiningPassTicket[];
  pendingLineCount: number;
};

export type DiningPassDestination = "kitchen" | "bar";

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

function groupLinesByCourse(lines: DiningPassLine[], destination: DiningPassDestination): DiningPassCourseGroup[] {
  const groups = new Map<string, DiningPassCourseGroup>();

  for (const line of lines) {
    const key = destination === "bar" ? "_bar" : (line.courseType ?? "_other");
    const existing = groups.get(key);
    if (existing) {
      existing.lines.push(line);
      continue;
    }
    groups.set(key, {
      courseType: destination === "bar" ? null : line.courseType,
      label:
        destination === "bar"
          ? "Boissons"
          : line.courseType
            ? mealCourseLabel(line.courseType)
            : "Autres",
      lines: [line],
    });
  }

  if (destination === "bar") {
    return [...groups.values()].map((g) => ({
      ...g,
      lines: [...g.lines].sort(
        (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      ),
    }));
  }

  const order = ["entrée", "plat", "dessert", "_other"];
  return [...groups.values()]
    .sort((a, b) => {
      const ka = a.courseType ?? "_other";
      const kb = b.courseType ?? "_other";
      return order.indexOf(ka) - order.indexOf(kb);
    })
    .map((g) => ({
      ...g,
      lines: [...g.lines].sort(
        (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      ),
    }));
}

function lineMatchesDestination(
  destination: DiningPassDestination,
  courseType: string | null | undefined,
  menuCategory: string | null | undefined,
  categoryPath: string | null | undefined
): boolean {
  return destination === "bar"
    ? lineGoesToBarPass({ courseType, menuCategory, categoryPath })
    : lineGoesToKitchenPass({ courseType, menuCategory, categoryPath });
}

/** File d'attente pass cuisine ou pass bar (lignes envoyées, non prêtes). */
export async function loadDiningPassQueue(
  restaurantId: string,
  destination: DiningPassDestination
): Promise<{ data: DiningPassQueue; error: Error | null }> {
  const { data: openBundle, error: oErr } = await listOpenDiningOrdersWithCustomerNames(restaurantId);
  if (oErr) return { data: { tickets: [], pendingLineCount: 0 }, error: oErr };

  const [thresholds, { data: flatCategories }] = await Promise.all([
    loadDiningWaitThresholds(restaurantId),
    listRestaurantCategories(restaurantId),
  ]);

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
        "id, dining_order_id, dish_id, qty, is_prepared, course_type, sent_to_kitchen_at, created_at, kitchen_mods_snapshot, dishes(name, menu_category, category_id, selling_price_ttc, selling_vat_rate_pct)"
      )
      .eq("restaurant_id", restaurantId)
      .in("dining_order_id", orderIds)
      .not("sent_to_kitchen_at", "is", null)
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

  const linesByOrder = new Map<string, DiningPassLine[]>();
  const rawLines = (linesRes.data ?? []) as unknown as (LineWithDish & {
    created_at: string;
    sent_to_kitchen_at: string;
    course_type?: string | null;
    kitchen_mods_snapshot?: unknown;
  })[];

  for (const raw of rawLines) {
    const dish = dishFromJoin(raw);
    const courseRaw = raw.course_type;
    const menuCategory = dish?.menu_category ?? null;
    const categoryPath =
      dish?.category_id && flatCategories?.length
        ? categoryPathLabel(dish.category_id, flatCategories)
        : null;

    const courseType = resolveMealCourse({
      storedCourseType: courseRaw,
      menuCategory,
      categoryPath,
    });

    if (!lineMatchesDestination(destination, courseType, menuCategory, categoryPath)) continue;

    const snapshot = parseKitchenModsSnapshot(
      (raw as { kitchen_mods_snapshot?: unknown }).kitchen_mods_snapshot
    );
    const kitchenLabels = kitchenLabelsFromSnapshot(snapshot);
    const arr = linesByOrder.get(raw.dining_order_id) ?? [];
    const sentAt = raw.sent_to_kitchen_at;
    arr.push({
      id: raw.id,
      dishName: dish?.name ?? "Article",
      qty: Number(raw.qty),
      isPrepared: Boolean(raw.is_prepared),
      courseType,
      createdAt: raw.created_at,
      sentAt,
      kitchenLabels,
    });
    linesByOrder.set(raw.dining_order_id, arr);
  }

  const tickets: DiningPassTicket[] = [];
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

    const sortedPending = [...pendingLines].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
    const oldestSentAt = sortedPending[0]?.sentAt ?? null;
    const waitColor = waitColorFromSentAt(oldestSentAt, thresholds);

    tickets.push({
      orderId: order.id,
      label: orderLabel({
        counterLabel: order.counter_ticket_label,
        tableLabel,
        customerName,
        guestNotes: order.notes,
      }),
      courseGroups: groupLinesByCourse(sortedPending, destination),
      pendingLines: sortedPending,
      oldestSentAt,
      waitColor,
    });
  }

  tickets.sort((a, b) => {
    const urgency = waitColorUrgencyRank(b.waitColor) - waitColorUrgencyRank(a.waitColor);
    if (urgency !== 0) return urgency;
    const ta = a.oldestSentAt ? new Date(a.oldestSentAt).getTime() : 0;
    const tb = b.oldestSentAt ? new Date(b.oldestSentAt).getTime() : 0;
    return ta - tb;
  });

  return { data: { tickets, pendingLineCount }, error: null };
}

export async function loadKitchenPassQueue(restaurantId: string) {
  return loadDiningPassQueue(restaurantId, "kitchen");
}

export async function loadBarPassQueue(restaurantId: string) {
  return loadDiningPassQueue(restaurantId, "bar");
}

/** @deprecated Utiliser DiningPassQueue */
export type KitchenPassLine = DiningPassLine;
export type KitchenPassCourseGroup = DiningPassCourseGroup;
export type KitchenPassTicket = DiningPassTicket;
export type KitchenPassQueue = DiningPassQueue;
