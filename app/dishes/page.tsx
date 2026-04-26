import Link from "next/link";
import { redirect } from "next/navigation";
import { getDishes, getDishComponentCounts } from "@/lib/db";
import {
  buildCategoryTree,
  buildDirectItemsByCategoryId,
  filterCategoryTreeByIds,
  listRestaurantCategories,
  pruneCategoryTreeWithItems,
  visibleCategoryIdsWithAncestors,
} from "@/lib/catalog/restaurantCategories";
import { findRecipeSuggestionForDish } from "@/lib/recipes/findRecipeSuggestionForDish";
import { getRestaurantForPage } from "@/lib/auth";
import { getTemplateSuggestions } from "@/app/restaurants/actions";
import { CreateDishForm } from "./CreateDishForm";
import { DishesNestedCategoryTiles } from "./DishesNestedCategoryTiles";
import { DishTemplateSuggestionsBlock } from "./DishTemplateSuggestionsBlock";
import { uiBackLink, uiError, uiLead, uiPageTitle } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ name?: string; returnTo?: string }> };

export default async function DishesPage({ searchParams }: Props) {
  const restaurant = await getRestaurantForPage();
  const params = await searchParams;
  const initialDishName = typeof params.name === "string" ? params.name : "";
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : "";
  if (!restaurant) redirect("/onboarding");

  const [{ data: dishes, error }, { suggestions }, catRes] = await Promise.all([
    getDishes(restaurant.id),
    getTemplateSuggestions(restaurant.id),
    listRestaurantCategories(restaurant.id),
  ]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className={`max-w-md ${uiError}`}>
          <p className="font-semibold">Erreur</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const flatCats = catRes.data ?? [];
  const list = dishes ?? [];

  const dishIds = list.map((d) => d.id);
  const { data: componentCounts } = await getDishComponentCounts(restaurant.id, dishIds);

  const directMap = buildDirectItemsByCategoryId(list);
  const assignedIds = [...new Set(list.map((d) => d.category_id).filter(Boolean) as string[])];
  const visible = visibleCategoryIdsWithAncestors(flatCats, assignedIds);
  const tree = buildCategoryTree(flatCats);
  const filtered = filterCategoryTreeByIds(tree, visible);
  const prunedRoots = pruneCategoryTreeWithItems(filtered, directMap);
  const uncategorized = list.filter((d) => !d.category_id);

  const dishExtras = new Map(
    list.map((d) => {
      const compCount = componentCounts.get(d.id) ?? 0;
      return [
        d.id,
        {
          compCount,
          suggestionAvailable:
            (d.recipe_status === "missing" || compCount === 0) &&
            findRecipeSuggestionForDish(d.name) != null,
        },
      ] as const;
    })
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Plats vendus</h1>
        <p className={`mt-2 ${uiLead}`}>
          Définir le mode (préparé / revente) et les composants pour le calcul de consommation.
        </p>
      </div>

      <CreateDishForm initialName={initialDishName} returnTo={returnTo} />

      <p className="flex flex-wrap gap-x-4 gap-y-2">
        <Link href="/dishes/import-menu" className={uiBackLink}>
          Importer des plats depuis une photo de carte →
        </Link>
        <Link href="/account#rubriques" className={uiBackLink}>
          Rubriques (carte & stock) →
        </Link>
      </p>

      <DishTemplateSuggestionsBlock restaurantId={restaurant.id} suggestions={suggestions} />

      {!dishes?.length ? (
        <p className={uiLead}>
          Aucun plat. Créez-en depuis un service (ligne inconnue → + Nouveau plat) ou ajoutez une page de création si besoin.
        </p>
      ) : (
        <DishesNestedCategoryTiles
          roots={prunedRoots}
          directMap={directMap}
          dishExtras={dishExtras}
          uncategorized={uncategorized}
        />
      )}
    </div>
  );
}
