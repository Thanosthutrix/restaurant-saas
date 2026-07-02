import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listHygieneRecurrencePresets } from "@/lib/hygiene/hygieneDb";
import { cachedListHygieneElements } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";
import { HygieneElementsClient } from "./HygieneElementsClient";

type Search = { elementId?: string };

export default async function HygieneElementsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const initialElementId = typeof sp.elementId === "string" ? sp.elementId : null;

  const [elements, presets] = await Promise.all([
    cachedListHygieneElements(restaurant.id),
    listHygieneRecurrencePresets(),
  ]);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.hygiene.icon}
        accentTone={SECTION_ACCENT.hygiene.tone}
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Éléments à nettoyer" },
        ]}
        title="Éléments à nettoyer"
        subtitle={
          <>
            Votre référentiel de nettoyage en tuiles. Touchez une tuile pour voir le protocole et agir ; utilisez{" "}
            <strong className="font-medium text-stone-700">Marquer comme fait</strong> pour enregistrer aussitôt une
            exécution au registre (nom, heure, commentaire et photo optionnelle).
          </>
        }
      />

      <HygieneElementsClient
        restaurantId={restaurant.id}
        elements={elements}
        presets={presets}
        initialElementId={initialElementId}
      />
    </PageContainer>
  );
}
