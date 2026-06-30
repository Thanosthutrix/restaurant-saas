import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  listActivePreparations,
  listPreparationDishes,
  listPreparationInventoryItems,
} from "@/lib/preparations/preparationsDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";
import { PreparationsClient } from "./PreparationsClient";

export default async function PreparationsPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [preps, dishes, active] = await Promise.all([
    listPreparationInventoryItems(restaurant.id),
    listPreparationDishes(restaurant.id),
    listActivePreparations(restaurant.id),
  ]);

  return (
    <PageContainer width="narrow">
      <PageHeader
        accentIcon={SECTION_ACCENT.preparations.icon}
        accentTone={SECTION_ACCENT.preparations.tone}
        breadcrumbs={[{ label: "Cuisine", href: "/cuisine" }, { label: "Préparations" }]}
        title="Préparations"
        subtitle="Lancez une préparation (DLC + température de fin), puis enregistrez le contrôle à +2 h. La fiche reste affichée jusqu'à sa clôture."
      />

      <PreparationsClient restaurantId={restaurant.id} inventoryPreps={preps} dishes={dishes} active={active} />

      <p className="text-center text-sm">
        <Link href="/preparations/registre" className="font-medium text-copper-800 underline">
          Registre complet des préparations
        </Link>
      </p>
    </PageContainer>
  );
}
