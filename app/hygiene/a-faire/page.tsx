import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  ensureHygieneTasksForRestaurant,
  listHygieneTasksDue,
  listHygieneTasksUpcoming,
} from "@/lib/hygiene/hygieneDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { HygieneTasksClient } from "./HygieneTasksClient";

export default async function HygieneTasksPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await ensureHygieneTasksForRestaurant(restaurant.id, 14);
  const [due, upcoming] = await Promise.all([
    listHygieneTasksDue(restaurant.id, 100),
    listHygieneTasksUpcoming(restaurant.id, 30),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <Link href="/hygiene" className={uiBackLink}>
          ← Nettoyage
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>À faire maintenant</h1>
        <p className={`mt-2 ${uiLead}`}>
          Tâches dont l’échéance est passée ou aujourd’hui. Les tâches critiques exigent une photo à la validation.
        </p>
      </div>

      <HygieneTasksClient restaurantId={restaurant.id} due={due} upcoming={upcoming} />
    </div>
  );
}
