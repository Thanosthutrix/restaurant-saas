import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  ensureFryerOilTasksForRestaurant,
  listPendingFryerOilTasks,
} from "@/lib/fryerOil/fryerOilDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Droplets } from "lucide-react";
import { FryerOilCheckClient } from "./FryerOilCheckClient";

export default async function FryerOilCheckPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await ensureFryerOilTasksForRestaurant(restaurant.id, 14);
  const tasks = await listPendingFryerOilTasks(restaurant.id);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Droplets}
        accentTone="bg-amber-50 text-amber-800"
        breadcrumbs={[
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Huile friture", href: "/hygiene/huile-friture" },
          { label: "Contrôles" },
        ]}
        title="Contrôles huile à faire"
        subtitle="TPM, température, filtration et qualité — un contrôle par friteuse et par créneau."
      />
      <FryerOilCheckClient restaurantId={restaurant.id} tasks={tasks} />
    </PageContainer>
  );
}
