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
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
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
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Préparations</h1>
        <p className={`mt-2 ${uiLead}`}>
          Enregistrez un lot, la température en fin de préparation, le contrôle après refroidissement (+2 h) et la DLC.
        </p>
      </div>

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
        <Link href="/preparations/registre" className="font-medium text-indigo-700 underline">
          Registre complet des préparations
        </Link>
      </p>
    </div>
  );
}
