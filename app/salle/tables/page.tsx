import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listAllDiningTablesForAdmin } from "@/lib/dining/diningDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { SalleTablesClient } from "./SalleTablesClient";

export default async function SalleTablesAdminPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: tables, error } = await listAllDiningTablesForAdmin(restaurant.id);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-6">
      <div>
        <Link href="/salle" className={uiBackLink}>
          ← Salle
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Tables</h1>
        <p className={`mt-2 ${uiLead}`}>
          Libellés affichés en salle. Les tables inactives n’apparaissent pas sur le plan.
        </p>
      </div>

      <SalleTablesClient restaurantId={restaurant.id} tables={tables ?? []} />
    </div>
  );
}
