import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listHygieneRecurrencePresets } from "@/lib/hygiene/hygieneDb";
import { cachedListHygieneElements } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
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
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Hygiène", href: "/hygiene" }, { label: "Éléments à nettoyer" }]}
        title="Éléments à nettoyer"
        subtitle={
          <>
            Référentiel par restaurant. Les fréquences par défaut sont des suggestions (référentiel métier), modifiables
            par ligne. Utilisez <strong className="font-medium text-stone-700">Marquer comme fait</strong> pour enregistrer
            tout de suite une exécution au registre (nom, heure, commentaire et photo optionnelle).
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
