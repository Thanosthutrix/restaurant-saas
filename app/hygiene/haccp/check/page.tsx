import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { ensureTemperatureTasksForRestaurant, listPendingTemperatureTasks } from "@/lib/haccpTemperature/haccpTemperatureDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { HaccpCheckClient } from "./HaccpCheckClient";

export default async function HaccpCheckPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await ensureTemperatureTasksForRestaurant(restaurant.id, 14);
  const tasks = await listPendingTemperatureTasks(restaurant.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Link href="/hygiene/haccp" className={uiBackLink}>
          ← Températures HACCP
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Relevés à faire</h1>
        <p className={`mt-2 ${uiLead}`}>
          Saisissez la température pour chaque tâche. En cas d’alerte ou d’écart critique, commentaire et action
          corrective sont obligatoires.
        </p>
      </div>

      <HaccpCheckClient restaurantId={restaurant.id} tasks={tasks} />
    </div>
  );
}
