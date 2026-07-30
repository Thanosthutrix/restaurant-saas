import {
  buildCategoryTree,
  buildDirectItemsByCategoryId,
  categoryPathLabel,
  filterCategoryTreeByIds,
  listRestaurantCategories,
  pruneCategoryTreeWithItems,
  visibleCategoryIdsWithAncestors,
  type CategoryTreeNode,
  type RestaurantCategory,
} from "@/lib/catalog/restaurantCategories";
import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import { getCustomerById } from "@/lib/customers/customersDb";
import type { CustomerLookupRow } from "@/lib/customers/customersDb";
import { getDishes, type Dish } from "@/lib/db";
import {
  getDiningOrder,
  getDiningOrderLines,
  getDiningOrderPayment,
  getDiningTable,
  lineGrossTtc,
  lineTtc,
  listDiningOrderPayments,
  orderTotalTtc,
  sumDiningOrderPayments,
} from "@/lib/dining/diningDb";
import { parseDiningDiscountKind } from "@/lib/dining/lineDiscount";
import { resolveMealCourse } from "@/lib/dining/courseTypes";
import { diningOrderGuestDisplayName, diningTableTicketTitle } from "@/lib/dining/ticketLabel";
import {
  listCustomizableComponentsForDish,
  listLineModificationsByLineIds,
} from "@/lib/dining/diningLineModificationsDb";
import {
  formatModificationsForKitchen,
  hasPendingKitchenMods,
  parseKitchenModsSnapshot,
} from "@/lib/dining/lineModificationLogic";
import { lineGoesToBarPass } from "@/lib/dining/passDestination";
import { isMenuCategory } from "@/lib/public/menuCategories";
import { dishFromJoin } from "@/lib/dining/diningDb";

export type DiningOrderLinkedCustomer = {
  id: string;
  display_name: string;
  service_memo: string | null;
  allergens_note: string | null;
};

export type DiningOrderViewData = {
  orderId: string;
  diningTableId: string | null;
  status: "open" | "settled";
  serviceId: string | null;
  placeDescription: string;
  settledPaymentMethod: string | null;
  lines: DiningLineClient[];
  totalTtc: number;
  /** Somme des paiements partiels déjà enregistrés (commande ouverte). */
  amountPaidTtc: number;
  /** Reste à encaisser (totalTtc − amountPaidTtc). */
  amountDueTtc: number;
  linkedCustomer: DiningOrderLinkedCustomer | null;
  linkedCustomerEmail: string | null;
  guestLabel: string | null;
};

export type DiningOrderCatalogData = {
  catalogRoots: CategoryTreeNode[];
  directByCategoryId: Record<string, Dish[]>;
  uncategorized: Dish[];
};

export function mapLinesToClients(
  lines: Awaited<ReturnType<typeof getDiningOrderLines>>["data"],
  opts?: {
    modsByLineId?: Map<string, import("@/lib/dining/lineModificationTypes").DiningLineModification[]>;
    customizableDishIds?: Set<string>;
    flatCategories?: RestaurantCategory[];
  }
): DiningLineClient[] {
  const modsByLineId = opts?.modsByLineId;
  const customizableDishIds = opts?.customizableDishIds;
  const flatCategories = opts?.flatCategories;

  return (lines ?? []).map((l) => {
    const d = Array.isArray(l.dishes) ? l.dishes[0] : l.dishes;
    const dishJoin = dishFromJoin(l as Parameters<typeof dishFromJoin>[0]);
    const menuCategoryRaw = dishJoin?.menu_category;
    const menuCategory = isMenuCategory(menuCategoryRaw) ? menuCategoryRaw : null;
    const categoryId = dishJoin?.category_id ?? null;
    const categoryPath =
      categoryId && flatCategories?.length
        ? categoryPathLabel(categoryId, flatCategories)
        : null;
    const isBarLine = lineGoesToBarPass({ menuCategory: menuCategoryRaw, categoryPath });
    const dv = l.discount_value;
    const discountValue = dv == null || dv === "" ? null : Number(dv);
    const modifications = modsByLineId?.get(l.id) ?? [];
    const kitchenLabels = formatModificationsForKitchen(modifications);
    const snapshot = parseKitchenModsSnapshot(
      (l as { kitchen_mods_snapshot?: unknown }).kitchen_mods_snapshot
    );
    const sentToKitchenAt =
      ((l as { sent_to_kitchen_at?: string | null }).sent_to_kitchen_at as string | null) ?? null;
    const pendingKitchenMods =
      Boolean(sentToKitchenAt) && hasPendingKitchenMods(modifications, snapshot);
    const courseType = resolveMealCourse({
      storedCourseType: (l as { course_type?: string }).course_type,
      menuCategory: menuCategoryRaw,
      categoryPath,
    });
    return {
      id: l.id,
      dishId: l.dish_id,
      dishName: d?.name ?? "Plat",
      qty: Number(l.qty),
      isPrepared: Boolean((l as { is_prepared?: boolean }).is_prepared),
      courseType,
      sentToKitchenAt,
      lineGrossTtc: lineGrossTtc(l),
      lineTotalTtc: lineTtc(l),
      discountKind: parseDiningDiscountKind(l.discount_kind),
      discountValue: discountValue != null && Number.isFinite(discountValue) ? discountValue : null,
      modifications,
      kitchenLabels,
      menuCategory,
      categoryPath,
      isBarLine,
      pendingKitchenMods,
      canCustomize: customizableDishIds?.has(l.dish_id) ?? false,
    };
  });
}

export async function mapLinesToClientsEnriched(
  restaurantId: string,
  lines: Awaited<ReturnType<typeof getDiningOrderLines>>["data"]
): Promise<DiningLineClient[]> {
  const raw = lines ?? [];
  if (raw.length === 0) return [];

  const lineIds = raw.map((l) => l.id);
  const dishIds = [...new Set(raw.map((l) => l.dish_id))];

  const [modsByLineId, customizableSets, { data: flatCategories }] = await Promise.all([
    listLineModificationsByLineIds(restaurantId, lineIds),
    Promise.all(dishIds.map((dishId) => listCustomizableComponentsForDish(restaurantId, dishId))),
    listRestaurantCategories(restaurantId),
  ]);

  const customizableDishIds = new Set<string>();
  dishIds.forEach((dishId, i) => {
    if ((customizableSets[i]?.length ?? 0) > 0) customizableDishIds.add(dishId);
  });

  return mapLinesToClients(raw, { modsByLineId, customizableDishIds, flatCategories: flatCategories ?? [] });
}

export async function loadDiningOrderCatalogData(
  restaurantId: string
): Promise<{ data: DiningOrderCatalogData | null; error: string | null }> {
  const [{ data: dishes, error: dErr }, { data: flatCats, error: catErr }] = await Promise.all([
    getDishes(restaurantId),
    listRestaurantCategories(restaurantId),
  ]);

  if (dErr || catErr) {
    return { data: null, error: dErr?.message ?? catErr?.message ?? "Impossible de charger la carte." };
  }

  const cats = flatCats ?? [];
  const dishList = dishes ?? [];
  const directMap = buildDirectItemsByCategoryId(dishList);
  const assignedIds = [...new Set(dishList.map((d) => d.category_id).filter(Boolean) as string[])];
  const visible = visibleCategoryIdsWithAncestors(cats, assignedIds);
  const tree = buildCategoryTree(cats);
  const filtered = filterCategoryTreeByIds(tree, visible);
  const prunedRoots = pruneCategoryTreeWithItems(filtered, directMap);
  const uncategorized = dishList.filter((d) => !d.category_id);
  const directByCategoryId = Object.fromEntries(directMap);

  return {
    data: {
      catalogRoots: prunedRoots,
      directByCategoryId,
      uncategorized,
    },
    error: null,
  };
}

export async function loadDiningOrderViewData(
  restaurantId: string,
  orderId: string
): Promise<{ data: DiningOrderViewData | null; error: string | null }> {
  const { data: order, error: oErr } = await getDiningOrder(orderId, restaurantId);
  if (oErr) return { data: null, error: oErr.message };
  if (!order) return { data: null, error: "Commande introuvable." };

  const [{ data: lines, error: lErr }, payRes, openPayRes, linkedCustomerRaw, tableRes] =
    await Promise.all([
      getDiningOrderLines(orderId, restaurantId),
      order.status === "settled"
        ? getDiningOrderPayment(orderId, restaurantId)
        : Promise.resolve({ data: null, error: null }),
      order.status === "open"
        ? listDiningOrderPayments(orderId, restaurantId)
        : Promise.resolve({ data: [], error: null }),
      order.customer_id ? getCustomerById(restaurantId, order.customer_id) : Promise.resolve(null),
      order.dining_table_id != null
        ? getDiningTable(order.dining_table_id, restaurantId)
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (lErr) return { data: null, error: lErr.message };

  const table = tableRes.data;
  const lineClients = await mapLinesToClientsEnriched(restaurantId, lines);
  const totalTtc = orderTotalTtc(lines ?? []);

  let amountPaidTtc = 0;
  if (order.status === "open") {
    if (openPayRes.error) return { data: null, error: openPayRes.error.message };
    amountPaidTtc = sumDiningOrderPayments(openPayRes.data);
  } else if (!payRes.error && payRes.data) {
    const raw = payRes.data.amount_ttc;
    const n = raw == null || raw === "" ? NaN : Number(raw);
    if (Number.isFinite(n)) amountPaidTtc = Math.round(n * 100) / 100;
  }
  const amountDueTtc = Math.max(0, Math.round((totalTtc - amountPaidTtc) * 100) / 100);

  let settledPaymentMethod: string | null = null;
  if (!payRes.error) {
    settledPaymentMethod = payRes.data?.payment_method ?? null;
  }

  const counterName = order.counter_ticket_label?.trim();
  const isCounterOrder = order.dining_table_id == null && Boolean(counterName);

  let linkedCustomer: DiningOrderLinkedCustomer | null = null;
  let linkedCustomerEmail: string | null = null;
  if (linkedCustomerRaw) {
    const em = linkedCustomerRaw.email?.trim() ?? "";
    linkedCustomerEmail = em || null;
    linkedCustomer = {
      id: linkedCustomerRaw.id,
      display_name: linkedCustomerRaw.display_name,
      service_memo: linkedCustomerRaw.service_memo,
      allergens_note: linkedCustomerRaw.allergens_note,
    };
  }

  const placeDescription = isCounterOrder
    ? (linkedCustomer?.display_name?.trim() || counterName) ?? "Comptoir"
    : diningTableTicketTitle(
        table?.label ?? "—",
        diningOrderGuestDisplayName(linkedCustomer?.display_name ?? null, order.notes)
      );

  return {
    data: {
      orderId,
      diningTableId: order.dining_table_id,
      status: order.status as "open" | "settled",
      serviceId: order.service_id,
      placeDescription,
      settledPaymentMethod,
      lines: lineClients,
      totalTtc,
      amountPaidTtc,
      amountDueTtc,
      linkedCustomer,
      linkedCustomerEmail,
      guestLabel: order.notes?.trim() || null,
    },
    error: null,
  };
}

export type DiningOrderSessionBundle = DiningOrderCatalogData & {
  customerSearchPool: CustomerLookupRow[];
};
