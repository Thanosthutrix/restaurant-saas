import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listRecentCustomersForLookup } from "@/lib/customers/customersDb";
import { getReservation } from "@/lib/reservations/reservationsDb";
import { uiBackLink, uiPageTitle } from "@/components/ui/premium";
import { EditReservationForm } from "./EditReservationForm";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> };

export const metadata = {
  title: "Modifier la réservation",
};

function parisYmd() {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
}

export default async function EditReservationPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  // Réservation et liste clients récents sont indépendantes : on les charge en parallèle.
  const [{ data: row, error }, recentCustomerPool] = await Promise.all([
    getReservation(id, restaurant.id),
    listRecentCustomersForLookup(restaurant.id, 80),
  ]);
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-sm text-rose-700">{error.message}</p>
      </div>
    );
  }
  if (!row) notFound();

  const returnYmd = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : parisYmd();

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <Link href={"/reservations?date=" + encodeURIComponent(returnYmd)} className={uiBackLink}>
        ← Réservations
      </Link>
      <h1 className={uiPageTitle}>Modifier la réservation</h1>
      <EditReservationForm
        restaurantId={restaurant.id}
        reservation={row}
        returnYmd={returnYmd}
        recentCustomerPool={recentCustomerPool}
      />
    </div>
  );
}
