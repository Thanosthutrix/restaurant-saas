import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { cachedLoadDiningOrderCatalogData } from "@/lib/cache";
import { listRecentCustomersForLookup } from "@/lib/customers/customersDb";
import { loadDiningOrderViewData } from "@/lib/dining/diningOrderViewData";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { DiningOrderClient } from "./DiningOrderClient";

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

  const [viewRes, catalogRes, customerSearchPool] = await Promise.all([
    loadDiningOrderViewData(restaurant.id, orderId),
    cachedLoadDiningOrderCatalogData(restaurant.id),
    listRecentCustomersForLookup(restaurant.id, 40),
  ]);

  if (viewRes.error || !viewRes.data) {
    if (viewRes.error === "Commande introuvable.") notFound();
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {viewRes.error}
        </p>
      </div>
    );
  }

  if (catalogRes.error || !catalogRes.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {catalogRes.error ?? "Impossible de charger la carte."}
        </p>
      </div>
    );
  }

  const view = viewRes.data;
  const { catalogRoots, directByCategoryId, uncategorized } = catalogRes.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={backHref} className={uiBackLink}>
          {backLabel}
        </Link>
        {view.status === "settled" ? (
          <span className="text-xs font-medium text-emerald-700">Encaissée</span>
        ) : null}
      </div>

      <div>
        <h1 className={uiPageTitle}>Commande</h1>
        <p className={`mt-1 text-sm ${uiLead}`}>{view.placeDescription}</p>
      </div>

      <DiningOrderClient
        restaurantId={restaurant.id}
        orderId={view.orderId}
        status={view.status}
        serviceId={view.serviceId}
        placeDescription={view.placeDescription}
        cancelRedirectHref={backHref}
        settledPaymentMethod={view.settledPaymentMethod}
        lines={view.lines}
        totalTtc={view.totalTtc}
        amountPaidTtc={view.amountPaidTtc}
        catalogRoots={catalogRoots}
        directByCategoryId={directByCategoryId}
        uncategorized={uncategorized}
        linkedCustomer={view.linkedCustomer}
        linkedCustomerEmail={view.linkedCustomerEmail}
        customerSearchPool={customerSearchPool}
        diningTableId={view.diningTableId}
        guestLabel={view.guestLabel}
      />
    </div>
  );
}
