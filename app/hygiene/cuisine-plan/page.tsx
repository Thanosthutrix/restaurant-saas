import Link from "next/link";
import { redirect } from "next/navigation";
import { Snowflake } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getRestaurantKitchenFloorPlanDocument } from "@/lib/cuisine/kitchenFloorPlanDb";
import { buildFloorEquipmentFromElements } from "@/lib/cuisine/kitchenEquipmentPlan";
import { cachedListColdHygieneElements } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { KitchenPlanEditorClient } from "./KitchenPlanEditorClient";

export default async function HygieneCuisinePlanPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [coldElements, { data: storedDocument }] = await Promise.all([
    cachedListColdHygieneElements(restaurant.id),
    getRestaurantKitchenFloorPlanDocument(restaurant.id),
  ]);

  const floorEquipment = buildFloorEquipmentFromElements(coldElements);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={Snowflake}
        accentTone="bg-sky-50 text-sky-700"
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Plan cuisine" },
        ]}
        title="Plan cuisine — équipements froid"
        subtitle="Organisez vos équipements sur un plan visuel pour faciliter les relevés de température à l'ouverture et à la fermeture."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/hygiene/temperatures-ouverture"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Relevés température
            </Link>
            <Link
              href="/hygiene/elements"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Éléments à nettoyer
            </Link>
          </div>
        }
      />

      {coldElements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
          <p className="text-base font-semibold text-stone-800">Aucun équipement froid actif</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
            Ajoutez une chambre froide, un frigo ou un congélateur dans{" "}
            <Link href="/hygiene/elements" className="font-medium text-copper-800 underline">
              Éléments à nettoyer
            </Link>{" "}
            pour les placer sur le plan.
          </p>
        </div>
      ) : (
        <KitchenPlanEditorClient
          restaurantId={restaurant.id}
          initialEquipment={floorEquipment}
          serverStoredDocument={storedDocument}
        />
      )}
    </PageContainer>
  );
}
