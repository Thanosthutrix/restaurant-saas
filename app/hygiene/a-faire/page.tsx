import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  listHygieneTasksDue,
  listHygieneTasksUpcoming,
} from "@/lib/hygiene/hygieneDb";
import { cachedEnsureHygieneTasks } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { HygieneTasksClient } from "./HygieneTasksClient";

export default async function HygieneTasksPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await cachedEnsureHygieneTasks(restaurant.id);
  const [due, upcoming] = await Promise.all([
    listHygieneTasksDue(restaurant.id, 100),
    listHygieneTasksUpcoming(restaurant.id, 30),
  ]);

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Hygiène", href: "/hygiene" }, { label: "À faire maintenant" }]}
        title="À faire maintenant"
        subtitle="Tâches dont l’échéance est passée ou aujourd’hui. Les tâches critiques exigent une photo à la validation."
      />

      <HygieneTasksClient restaurantId={restaurant.id} due={due} upcoming={upcoming} />
    </PageContainer>
  );
}
