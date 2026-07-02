import { redirect } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { cachedListTemperaturePoints } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { HaccpPointsClient } from "./HaccpPointsClient";

export default async function HaccpPointsPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const points = await cachedListTemperaturePoints(restaurant.id);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SlidersHorizontal}
        accentTone="bg-sky-50 text-sky-700"
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Températures HACCP", href: "/hygiene/haccp" },
          { label: "Points de mesure" },
        ]}
        title="Points de mesure"
        subtitle="Touchez une tuile pour la modifier. Définissez les emplacements, types, seuils min/max et fréquence des relevés."
      />

      <HaccpPointsClient restaurantId={restaurant.id} points={points} />
    </PageContainer>
  );
}
