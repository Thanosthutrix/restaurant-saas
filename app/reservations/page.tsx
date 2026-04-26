import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listDiningTables, mapCustomerDisplayNames } from "@/lib/dining/diningDb";
import { listReservationsForParisDay } from "@/lib/reservations/reservationsDb";
import { listRecentCustomersForLookup } from "@/lib/customers/customersDb";
import { uiLead, uiPageTitle } from "@/components/ui/premium";
import { ReservationsListClient } from "./ReservationsListClient";

function parisYmd(d: Date) {
  return d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export const metadata = {
  title: "Réservations",
};

export default async function ReservationsPage({ searchParams }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const ymd = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : parisYmd(new Date());

  const [{ data: rows, error: listErr }, recentCustomerPool, { data: diningTables, error: tablesErr }] = await Promise.all([
    listReservationsForParisDay(restaurant.id, ymd),
    listRecentCustomersForLookup(restaurant.id, 80),
    listDiningTables(restaurant.id),
  ]);

  if (listErr) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {listErr.message}
        </p>
      </div>
    );
  }
  if (tablesErr) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {tablesErr.message}
        </p>
      </div>
    );
  }

  const ids = (rows ?? [])
    .map((r) => r.customer_id)
    .filter((id): id is string => id != null && id.length > 0);
  const nameBy = await mapCustomerDisplayNames(restaurant.id, ids);

  const withLabels = (rows ?? []).map((r) => ({
    ...r,
    customerDisplayName: r.customer_id ? nameBy.get(r.customer_id) ?? null : null,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className={uiPageTitle}>Réservations</h1>
          <p className={`mt-1 ${uiLead}`}>
            Livre du jour (fuseau Europe/Paris). Création depuis le téléphone, le comptoir ou le site.
          </p>
        </div>
        <Link
          href="/reservations/nouvelle"
          className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nouvelle réservation
        </Link>
      </div>

      <ReservationsListClient
        restaurantId={restaurant.id}
        ymd={ymd}
        rows={withLabels}
        recentCustomerPool={recentCustomerPool}
        diningTables={diningTables ?? []}
      />
    </div>
  );
}
