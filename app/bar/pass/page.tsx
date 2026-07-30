import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { loadBarPassQueue } from "@/lib/dining/diningPassData";
import { BarPassClient } from "@/components/bar/BarPassClient";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export default async function BarPassPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data, error } = await loadBarPassQueue(restaurant.id);
  if (error) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Service"
          title="Pass bar"
          subtitle="Impossible de charger la file d'attente."
        />
        <p className="text-sm text-rose-700">{error.message}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Service"
        title="Pass bar"
        subtitle="Boissons et vins uniquement. Touchez « Prêt » une fois servi."
      />
      <BarPassClient restaurantId={restaurant.id} initialQueue={data} />
    </PageContainer>
  );
}
