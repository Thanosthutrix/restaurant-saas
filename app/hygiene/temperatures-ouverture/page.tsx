import { redirect } from "next/navigation";
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
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Hygiène", href: "/hygiene" }, { label: "Froid : ouverture / fermeture" }]}
        title="Froid : ouverture & fermeture"
        subtitle="Pour chaque chambre froide, frigo ou congélateur, enregistrez la température à l’ouverture et à la fermeture. Les relevés sont conservés dans le registre dédié."
      />
      <p className="text-xs text-stone-500">
        Support de traçabilité interne ; adaptez la fréquence et les seuils à votre procédure HACCP.
      </p>

      <HygieneColdTemperaturesClient
        restaurantId={restaurant.id}
        coldElements={coldElements}
        recentReadings={recentReadings}
      />
    </PageContainer>
  );
}
