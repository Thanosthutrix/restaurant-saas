import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, FolderTree, UtensilsCrossed } from "lucide-react";
import { getDishComponentCounts } from "@/lib/db";
import { cachedGetDishes } from "@/lib/cache";
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
import { getNavAccessLevel } from "@/lib/auth/requireNavAccess";
import { CreateDishForm } from "./CreateDishForm";
import { DishesNestedCategoryTiles } from "./DishesNestedCategoryTiles";
import { uiBtnSecondary, uiError } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type Props = { searchParams: Promise<{ name?: string; returnTo?: string }> };

export default async function DishesPage({ searchParams }: Props) {
  const restaurant = await getRestaurantForPage();
  const params = await searchParams;
  const initialDishName = typeof params.name === "string" ? params.name : "";
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : "";
  if (!restaurant) redirect("/onboarding");

  const [accessLevel, [{ data: dishes, error }, catRes]] = await Promise.all([
    getNavAccessLevel("dishes"),
    Promise.all([
      cachedGetDishes(restaurant.id),
      listRestaurantCategories(restaurant.id),
    ]),
  ]);
  const canWrite = accessLevel === "full";

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
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Cuisine", href: "/cuisine" }, { label: "Plats" }]}
        title="Plats vendus"
        subtitle="Définir le mode (préparé / revente) et les composants pour le calcul de consommation."
        actions={
          canWrite ? (
            <>
              <Link href="/dishes/import-menu" className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}>
                <Camera className="h-4 w-4" aria-hidden />
                Importer (photo)
              </Link>
              <Link href="/account#rubriques" className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}>
                <FolderTree className="h-4 w-4" aria-hidden />
                Rubriques
              </Link>
            </>
          ) : undefined
        }
      />

      {canWrite && <CreateDishForm initialName={initialDishName} returnTo={returnTo} />}

      {!dishes?.length ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Aucun plat pour l’instant"
          description="Créez votre premier plat avec le formulaire ci-dessus, ou importez votre carte depuis une photo."
          actionLabel="Importer depuis une photo"
          actionHref="/dishes/import-menu"
          actionIcon={Camera}
        />
      ) : (
        <DishesNestedCategoryTiles
          roots={prunedRoots}
          directMap={directMap}
          dishExtras={dishExtras}
          uncategorized={uncategorized}
          canWrite={canWrite}
        />
      )}
    </PageContainer>
  );
}
