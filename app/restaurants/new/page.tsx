import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getRestaurantTemplates } from "@/lib/templates/restaurantTemplates";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { CreateRestaurantForm } from "./CreateRestaurantForm";

export default async function NewRestaurantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = await getRestaurantForPage();
  if (!current) redirect("/onboarding");

  const templates = getRestaurantTemplates();

  return (
    <PageContainer width="narrow">
      <PageHeader
        accentIcon={Building2}
        accentTone="bg-copper-50 text-copper-700"
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Nouveau restaurant" },
        ]}
        subtitle="Ajoutez un établissement à votre compte. Le modèle choisi préremplit composants stock et plats suggérés."
        title="Créer un restaurant"
      />
      <CreateRestaurantForm templates={templates} />
    </PageContainer>
  );
}
