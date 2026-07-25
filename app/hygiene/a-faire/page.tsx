import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  listHygieneTasksDue,
  listHygieneTasksUpcoming,
} from "@/lib/hygiene/hygieneDb";
import { cachedEnsureHygieneTasks } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";
import { HygieneTasksPanel } from "@/components/hygiene/HygieneTasksPanel";

export default async function HygieneTasksPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await cachedEnsureHygieneTasks(restaurant.id);
  const [due, upcoming] = await Promise.all([
    listHygieneTasksDue(restaurant.id, 100),
    listHygieneTasksUpcoming(restaurant.id, 30),
  ]);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.hygiene.icon}
        accentTone={SECTION_ACCENT.hygiene.tone}
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Nettoyage", href: "/hygiene" },
          { label: "À faire maintenant" },
        ]}
        title="À faire maintenant"
        subtitle="Tâches en tuiles — touchez une tuile pour voir le protocole et valider. Les tâches critiques exigent une photo."
      />

      <HygieneTasksPanel restaurantId={restaurant.id} due={due} upcoming={upcoming} />
    </PageContainer>
  );
}
