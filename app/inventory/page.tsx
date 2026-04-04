import Link from "next/link";
import { redirect } from "next/navigation";
import { getInventoryItemsWithCalculatedStock } from "@/lib/db";
import { getCurrentRestaurant } from "@/lib/auth";
import { InventoryItemList } from "./InventoryItemList";
import { CreateInventoryItemForm } from "./CreateInventoryItemForm";
import { uiBackLink, uiError, uiInfoBanner, uiLead, uiPageTitle, uiSectionTitle } from "@/components/ui/premium";

export default async function InventoryPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const { data: items, error } = await getInventoryItemsWithCalculatedStock(restaurant.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Composants stockés</h1>
        <p className={`mt-2 ${uiLead}`}>
          Matières premières, préparations intermédiaires, articles en revente.
        </p>
      </div>

      <p className={uiInfoBanner}>
        <span className="font-semibold text-slate-800">Stock</span> = somme des mouvements (réceptions, consommations
        services, ajustements). Si la valeur de la fiche diffère, elle est indiquée entre parenthèses jusqu’à convergence (ex. données
        anciennes sans historique de mouvements).
      </p>

      {error && <div className={uiError}>{error.message}</div>}

      <CreateInventoryItemForm restaurantId={restaurant.id} />

      <div>
        <h2 className={`mb-3 ${uiSectionTitle}`}>Liste des composants</h2>
        <InventoryItemList items={items ?? []} />
      </div>
    </div>
  );
}
