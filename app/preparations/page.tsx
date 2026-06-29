import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  listPreparationDishes,
  listPreparationInventoryItems,
  listPreparationRecordsAwaiting2hCheck,
  listPreparationRecordsAwaitingTempEnd,
  listPreparationRecordsWithLotForLookup,
} from "@/lib/preparations/preparationsDb";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { PreparationsClient } from "./PreparationsClient";

type Search = { lot?: string; recordId?: string };

export default async function PreparationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const initialLotSearch = typeof sp.lot === "string" ? sp.lot : "";
  const initialRecordId = typeof sp.recordId === "string" ? sp.recordId : null;

  const [preps, dishes, awaitingEnd, awaiting2h, recordsWithLot] = await Promise.all([
    listPreparationInventoryItems(restaurant.id),
    listPreparationDishes(restaurant.id),
    listPreparationRecordsAwaitingTempEnd(restaurant.id),
    listPreparationRecordsAwaiting2hCheck(restaurant.id),
    listPreparationRecordsWithLotForLookup(restaurant.id),
  ]);

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Cuisine", href: "/cuisine" }, { label: "Préparations" }]}
        title="Préparations"
        subtitle="Enregistrez un lot, la température en fin de préparation, le contrôle après refroidissement (+2 h) et la DLC."
      />

      <PreparationsClient
        restaurantId={restaurant.id}
        inventoryPreps={preps}
        dishes={dishes}
        awaitingTempEnd={awaitingEnd}
        awaiting2h={awaiting2h}
        recordsWithLot={recordsWithLot}
        initialLotSearch={initialLotSearch}
        initialRecordId={initialRecordId}
      />

      <p className="text-center text-sm">
        <Link href="/preparations/registre" className="font-medium text-copper-800 underline">
          Registre complet des préparations
        </Link>
      </p>
    </PageContainer>
  );
}
