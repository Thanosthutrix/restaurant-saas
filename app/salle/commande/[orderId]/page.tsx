import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  buildCategoryTree,
  buildDirectItemsByCategoryId,
  filterCategoryTreeByIds,
  listRestaurantCategories,
  pruneCategoryTreeWithItems,
  visibleCategoryIdsWithAncestors,
} from "@/lib/catalog/restaurantCategories";
import { getDishes } from "@/lib/db";
import { getRestaurantForPage } from "@/lib/auth";
import { getCustomerById, listRecentCustomersForLookup } from "@/lib/customers/customersDb";
import {
  getDiningOrder,
  getDiningOrderLines,
  getDiningOrderPayment,
  getDiningTable,
  lineGrossTtc,
  lineTtc,
  orderTotalTtc,
} from "@/lib/dining/diningDb";
import { diningTableTicketTitle } from "@/lib/dining/ticketLabel";
import { parseDiningDiscountKind } from "@/lib/dining/lineDiscount";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { DiningOrderClient } from "./DiningOrderClient";
import type { DiningLineClient } from "../diningOrderTypes";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ from?: string; clientId?: string }>;
};

export default async function DiningOrderPage({ params, searchParams }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { orderId } = await params;
  const sp = await searchParams;
  const fromCaisse = sp.from === "caisse";
  const fromClients = sp.from === "clients";
  const returnClientId = sp.clientId?.trim() || "";
  const backHref = fromCaisse
    ? "/caisse"
    : fromClients
      ? returnClientId
        ? `/clients/${returnClientId}`
        : "/clients"
      : "/salle";
  const backLabel = fromCaisse
    ? "← Caisse"
    : fromClients
      ? returnClientId
        ? "← Fiche client"
        : "← Base clients"
      : "← Salle";

  const [
    { data: order, error: oErr },
    { data: dishes, error: dErr },
    { data: flatCats, error: catErr },
    customerSearchPool,
  ] = await Promise.all([
    getDiningOrder(orderId, restaurant.id),
    getDishes(restaurant.id),
    listRestaurantCategories(restaurant.id),
    listRecentCustomersForLookup(restaurant.id, 80),
  ]);

  if (oErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {oErr.message}
        </p>
      </div>
    );
  }

  if (!order) notFound();

  const { data: lines, error: lErr } = await getDiningOrderLines(orderId, restaurant.id);

  if (lErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {lErr.message}
        </p>
      </div>
    );
  }

  const { data: table } =
    order.dining_table_id != null
      ? await getDiningTable(order.dining_table_id, restaurant.id)
      : { data: null };

  if (dErr || catErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {dErr?.message ?? catErr?.message ?? "Impossible de charger la carte."}
        </p>
      </div>
    );
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

  const lineClients: DiningLineClient[] = (lines ?? []).map((l) => {
    const d = Array.isArray(l.dishes) ? l.dishes[0] : l.dishes;
    const dv = l.discount_value;
    const discountValue = dv == null || dv === "" ? null : Number(dv);
    return {
      id: l.id,
      dishId: l.dish_id,
      dishName: d?.name ?? "Plat",
      qty: Number(l.qty),
      isPrepared: Boolean((l as { is_prepared?: boolean }).is_prepared),
      lineGrossTtc: lineGrossTtc(l),
      lineTotalTtc: lineTtc(l),
      discountKind: parseDiningDiscountKind(l.discount_kind),
      discountValue: discountValue != null && Number.isFinite(discountValue) ? discountValue : null,
    };
  });

  const totalTtc = orderTotalTtc(lines ?? []);

  let settledPaymentMethod: string | null = null;
  if (order.status === "settled") {
    const payRes = await getDiningOrderPayment(orderId, restaurant.id);
    if (!payRes.error) {
      settledPaymentMethod = payRes.data?.payment_method ?? null;
    }
  }

  const counterName = order.counter_ticket_label?.trim();
  const isCounterOrder = order.dining_table_id == null && Boolean(counterName);

  let linkedCustomer: {
    id: string;
    display_name: string;
    service_memo: string | null;
    allergens_note: string | null;
  } | null = null;
  let linkedCustomerEmail: string | null = null;
  if (order.customer_id) {
    const cust = await getCustomerById(restaurant.id, order.customer_id);
    if (cust) {
      const em = cust.email?.trim() ?? "";
      linkedCustomerEmail = em || null;
      linkedCustomer = {
        id: cust.id,
        display_name: cust.display_name,
        service_memo: cust.service_memo,
        allergens_note: cust.allergens_note,
      };
    }
  }

  /** Fiche liée = nom affiché (évite « Comptoir · Comptoir 21:28… »). */
  const placeDescription = isCounterOrder
    ? (linkedCustomer?.display_name?.trim() || counterName) ?? "Comptoir"
    : diningTableTicketTitle(table?.label ?? "—", linkedCustomer?.display_name ?? null);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={backHref} className={uiBackLink}>
          {backLabel}
        </Link>
        {order.status === "settled" ? (
          <span className="text-xs font-medium text-emerald-700">Encaissée</span>
        ) : null}
      </div>

      <div>
        <h1 className={uiPageTitle}>Commande</h1>
        <p className={`mt-1 text-sm ${uiLead}`}>{placeDescription}</p>
      </div>

      <DiningOrderClient
        restaurantId={restaurant.id}
        orderId={orderId}
        status={order.status as "open" | "settled"}
        serviceId={order.service_id}
        placeDescription={placeDescription}
        cancelRedirectHref={backHref}
        settledPaymentMethod={settledPaymentMethod}
        lines={lineClients}
        totalTtc={totalTtc}
        catalogRoots={prunedRoots}
        directByCategoryId={directByCategoryId}
        uncategorized={uncategorized}
        linkedCustomer={linkedCustomer}
        linkedCustomerEmail={linkedCustomerEmail}
        customerSearchPool={customerSearchPool}
      />
    </div>
  );
}
