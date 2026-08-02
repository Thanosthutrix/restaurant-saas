import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listFryerUnits } from "@/lib/fryerOil/fryerOilDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { Droplets } from "lucide-react";
import { FryerUnitsClient } from "./FryerUnitsClient";

export default async function FryerUnitsPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const units = await listFryerUnits(restaurant.id);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Droplets}
        accentTone="bg-amber-50 text-amber-800"
        breadcrumbs={[
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Huile friture", href: "/hygiene/huile-friture" },
          { label: "Friteuses" },
        ]}
        title="Friteuses"
        subtitle="Seuils TPM et température par équipement — valeurs par défaut conformes DGCCRF (22 % alerte · 25 % changement)."
      />
      <FryerUnitsClient restaurantId={restaurant.id} units={units} />
    </PageContainer>
  );
}
