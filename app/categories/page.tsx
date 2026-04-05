import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { buildCategoryTree, listRestaurantCategories } from "@/lib/catalog/restaurantCategories";
import { CategoriesTreeClient } from "./CategoriesTreeClient";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";

export default async function CategoriesPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const { data: flat, error } = await listRestaurantCategories(restaurant.id);
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error.message}
        </p>
      </div>
    );
  }

  const tree = buildCategoryTree(flat);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Rubriques</h1>
        <p className={`mt-2 ${uiLead}`}>
          Créez vos propres rubriques et sous-rubriques pour classer les plats (carte) et les composants
          stock (ex. Vin → Bordeaux → Rouge). La portée indique si la rubrique apparaît pour la carte,
          pour le stock, ou pour les deux.
        </p>
      </div>

      <CategoriesTreeClient restaurantId={restaurant.id} tree={tree} />
    </div>
  );
}
