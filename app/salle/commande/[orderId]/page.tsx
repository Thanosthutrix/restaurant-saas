import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDishes } from "@/lib/db";
import { getCurrentRestaurant } from "@/lib/auth";
import {
  getDiningOrder,
  getDiningOrderLines,
  getDiningOrderPayment,
  getDiningTable,
  lineGrossTtc,
  lineTtc,
  orderTotalTtc,
} from "@/lib/dining/diningDb";
import { parseDiningDiscountKind } from "@/lib/dining/lineDiscount";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { DiningOrderClient } from "./DiningOrderClient";
import type { DiningLineClient } from "../diningOrderTypes";

type Props = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function DiningOrderPage({ params, searchParams }: Props) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const { orderId } = await params;
  const sp = await searchParams;
  const fromCaisse = sp.from === "caisse";
  const backHref = fromCaisse ? "/caisse" : "/salle";
  const backLabel = fromCaisse ? "← Caisse" : "← Salle";

  const [{ data: order, error: oErr }, { data: dishes, error: dErr }] = await Promise.all([
    getDiningOrder(orderId, restaurant.id),
    getDishes(restaurant.id),
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

  if (dErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {dErr?.message ?? "Impossible de charger les plats."}
        </p>
      </div>
    );
  }

  const lineClients: DiningLineClient[] = (lines ?? []).map((l) => {
    const d = Array.isArray(l.dishes) ? l.dishes[0] : l.dishes;
    const dv = l.discount_value;
    const discountValue = dv == null || dv === "" ? null : Number(dv);
    return {
      id: l.id,
      dishId: l.dish_id,
      dishName: d?.name ?? "Plat",
      qty: Number(l.qty),
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
  const placeDescription = counterName
    ? `Ticket comptoir · ${counterName}`
    : `Table ${table?.label ?? "—"}`;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div>
        <Link href={backHref} className={uiBackLink}>
          {backLabel}
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Commande</h1>
        <p className={`mt-2 ${uiLead}`}>
          {placeDescription}
          {order.status === "settled" ? " · Encaissée" : ""}
        </p>
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
        dishes={dishes ?? []}
      />
    </div>
  );
}
