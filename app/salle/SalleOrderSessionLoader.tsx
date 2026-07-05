import { listRecentCustomersForLookup } from "@/lib/customers/customersDb";
import { cachedLoadDiningOrderCatalogData } from "@/lib/cache";
import type { FloorTable } from "@/components/salle/InteractiveFloorPlan";
import { SalleFloorPlanClient } from "./SalleFloorPlanClient";

type TableTileSummary = {
  id: string;
  label: string;
  clientName?: string;
};

type Props = {
  restaurantId: string;
  initialTables: FloorTable[];
  tableSummaries?: TableTileSummary[];
};

export async function SalleOrderSessionLoader({
  restaurantId,
  initialTables,
  tableSummaries,
}: Props) {
  const [catalogRes, customerSearchPool] = await Promise.all([
    cachedLoadDiningOrderCatalogData(restaurantId),
    listRecentCustomersForLookup(restaurantId, 40),
  ]);

  if (catalogRes.error || !catalogRes.data) {
    return (
      <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        {catalogRes.error ?? "Impossible de charger la carte."}
      </p>
    );
  }

  return (
    <SalleFloorPlanClient
      restaurantId={restaurantId}
      initialTables={initialTables}
      orderSession={{
        ...catalogRes.data,
        customerSearchPool,
      }}
      tableSummaries={tableSummaries}
    />
  );
}
