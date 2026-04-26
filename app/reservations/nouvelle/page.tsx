import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listRecentCustomersForLookup } from "@/lib/customers/customersDb";
import { uiBackLink, uiPageTitle } from "@/components/ui/premium";
import { NewReservationForm } from "./NewReservationForm";

export const metadata = {
  title: "Nouvelle réservation",
};

export default async function NewReservationPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");
  const recentCustomerPool = await listRecentCustomersForLookup(restaurant.id, 80);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <Link href="/reservations" className={uiBackLink}>
        ← Réservations
      </Link>
      <h1 className={uiPageTitle}>Nouvelle réservation</h1>
      <NewReservationForm restaurantId={restaurant.id} recentCustomerPool={recentCustomerPool} />
    </div>
  );
}
