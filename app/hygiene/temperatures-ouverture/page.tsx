import { redirect } from "next/navigation";
import { Snowflake } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getRestaurantKitchenFloorPlanDocument } from "@/lib/cuisine/kitchenFloorPlanDb";
import { listColdTemperatureRegister, listTodayColdReadingsForEvent } from "@/lib/hygiene/hygieneDb";
import { cachedListColdHygieneElements } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { HygieneColdTemperaturesClient } from "./HygieneColdTemperaturesClient";

function readingsToRecord(map: Map<string, { temperature_celsius: number }>): Record<string, number> {
  return Object.fromEntries(
    [...map.entries()].map(([id, reading]) => [id, reading.temperature_celsius])
  );
}

export default async function HygieneTemperaturesPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [coldElements, recentReadings, { data: kitchenPlanDocument }, todayOpening, todayClosing] =
    await Promise.all([
      cachedListColdHygieneElements(restaurant.id),
      listColdTemperatureRegister(restaurant.id, 15),
      getRestaurantKitchenFloorPlanDocument(restaurant.id),
      listTodayColdReadingsForEvent(restaurant.id, "opening"),
      listTodayColdReadingsForEvent(restaurant.id, "closing"),
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
        subtitle="Saisissez les températures en vue liste ou sur le plan cuisine. Les relevés alimentent le registre dédié."
      />

      <HygieneColdTemperaturesClient
        restaurantId={restaurant.id}
        coldElements={coldElements}
        recentReadings={recentReadings}
        kitchenPlanDocument={kitchenPlanDocument}
        todayOpeningByElement={readingsToRecord(todayOpening)}
        todayClosingByElement={readingsToRecord(todayClosing)}
      />
    </PageContainer>
  );
}
