import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { loadKitchenPassQueue } from "@/lib/dining/kitchenPassData";
import { KitchenPassClient } from "@/components/cuisine/KitchenPassClient";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export default async function KitchenPassPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data, error } = await loadKitchenPassQueue(restaurant.id);
  if (error) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Service"
          title="Pass cuisine"
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
          { label: "Cuisine", href: "/cuisine" },
          { label: "Pass cuisine" },
        ]}
        title="Pass cuisine"
        subtitle="Les bons apparaissent quand le serveur valide un service. Triés par urgence (rouge en premier). Touchez « Prêt » ligne par ligne ou « Tout prêt » pour le ticket."
      />
      <KitchenPassClient restaurantId={restaurant.id} initialQueue={data} />
    </PageContainer>
  );
}
