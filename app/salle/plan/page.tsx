import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getRestaurantFloorPlanDocument } from "@/lib/dining/floorPlanDb";
import { listDiningTables } from "@/lib/dining/diningDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { type FloorTable } from "@/components/salle/InteractiveFloorPlan";
import { FloorPlanEditorClient } from "./FloorPlanEditorClient";

export default async function SallePlanPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [{ data: tables, error }, { data: storedDocument }] = await Promise.all([
    listDiningTables(restaurant.id),
    getRestaurantFloorPlanDocument(restaurant.id),
  ]);
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error.message}
        </p>
      </div>
    );
  }

  const floorTables: FloorTable[] = (tables ?? []).map((table, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      id: table.id,
      label: table.label,
      capacity: 4,
      x: 8 + column * 21,
      y: 12 + row * 20,
      width: 12,
      height: 12,
      rotation: 0,
      status: "free",
    };
  });

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Salle", href: "/salle" },
          { label: "Plan de salle" },
        ]}
        title="Plan de salle"
        subtitle="Structure fixe et placement de référence. Créez plusieurs espaces (RDC, terrasse, étages) via les onglets. Les déplacements temporaires en salle reviennent ici en fin de service."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/salle/tables"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Gérer les tables
            </Link>
            <Link
              href="/salle"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Retour à la salle
            </Link>
          </div>
        }
      />

      <FloorPlanEditorClient
        restaurantId={restaurant.id}
        initialTables={floorTables}
        serverStoredDocument={storedDocument}
      />
    </PageContainer>
  );
}
