import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listPendingTemperatureTasks } from "@/lib/haccpTemperature/haccpTemperatureDb";
import { cachedEnsureTemperatureTasks } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { HaccpCheckClient } from "./HaccpCheckClient";

export default async function HaccpCheckPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await cachedEnsureTemperatureTasks(restaurant.id);
  const tasks = await listPendingTemperatureTasks(restaurant.id);

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[
          { label: "Hygiène", href: "/hygiene" },
          { label: "Températures HACCP", href: "/hygiene/haccp" },
          { label: "Relevés à faire" },
        ]}
        title="Relevés à faire"
        subtitle="Saisissez la température pour chaque tâche. En cas d’alerte ou d’écart critique, commentaire et action corrective sont obligatoires."
      />

      <HaccpCheckClient restaurantId={restaurant.id} tasks={tasks} />
    </PageContainer>
  );
}
