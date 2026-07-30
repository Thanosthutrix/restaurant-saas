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
        breadcrumbs={[
          { label: "Salle", href: "/salle" },
          { label: "Pass bar" },
        ]}
        title="Pass bar"
        subtitle="Boissons et vins uniquement. Tri par urgence (rouge en premier). Touchez « Prêt » ou « Tout prêt » — le serveur est notifié quand tout est prêt."
      />
      <BarPassClient restaurantId={restaurant.id} initialQueue={data} />
    </PageContainer>
  );
}
