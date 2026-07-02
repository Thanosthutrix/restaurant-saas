import { redirect } from "next/navigation";
import { Snowflake } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { listColdTemperatureRegister } from "@/lib/hygiene/hygieneDb";
import { cachedListColdHygieneElements } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { HygieneColdTemperaturesClient } from "./HygieneColdTemperaturesClient";

export default async function HygieneTemperaturesPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [coldElements, recentReadings] = await Promise.all([
    cachedListColdHygieneElements(restaurant.id),
    listColdTemperatureRegister(restaurant.id, 15),
  ]);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Snowflake}
        accentTone="bg-sky-50 text-sky-700"
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Froid : ouverture / fermeture" },
        ]}
        title="Froid : ouverture & fermeture"
        subtitle="Touchez un équipement pour enregistrer sa température à l’ouverture ou à la fermeture. Les relevés sont conservés dans le registre dédié."
      />

      <HygieneColdTemperaturesClient
        restaurantId={restaurant.id}
        coldElements={coldElements}
        recentReadings={recentReadings}
      />
    </PageContainer>
  );
}
