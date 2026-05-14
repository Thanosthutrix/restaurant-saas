import Link from "next/link";
import { redirect } from "next/navigation";
import { getInventoryItemsWithCalculatedStock } from "@/lib/db";
import {
  buildCategoryTree,
  buildDirectItemsByCategoryId,
  filterCategoryTreeByIds,
  listRestaurantCategories,
  pruneCategoryTreeWithItems,
  visibleCategoryIdsWithAncestors,
} from "@/lib/catalog/restaurantCategories";
import { getRestaurantForPage } from "@/lib/auth";
import { getNavAccessLevel } from "@/lib/auth/requireNavAccess";
import { InventoryCategoryTiles } from "./InventoryCategoryTiles";
import { CreateInventoryItemForm } from "./CreateInventoryItemForm";
import { uiBackLink, uiError, uiInfoBanner, uiLead, uiPageTitle, uiSectionTitle } from "@/components/ui/premium";

export default async function InventoryPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");
  const access = await getNavAccessLevel("inventory");
  const canWrite = access === "full";

  const [{ data: items, error }, catRes] = await Promise.all([
    getInventoryItemsWithCalculatedStock(restaurant.id),
    listRestaurantCategories(restaurant.id),
  ]);

  const flatCats = catRes.data ?? [];
  const list = items ?? [];
  const directMap = buildDirectItemsByCategoryId(list);
  const assignedIds = [...new Set(list.map((i) => i.category_id).filter(Boolean) as string[])];
  const visible = visibleCategoryIdsWithAncestors(flatCats, assignedIds);
  const tree = buildCategoryTree(flatCats);
  const filtered = filterCategoryTreeByIds(tree, visible);
  const prunedRoots = pruneCategoryTreeWithItems(filtered, directMap);
  const uncategorized = list.filter((i) => !i.category_id);

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

      {canWrite && <CreateInventoryItemForm restaurantId={restaurant.id} />}

      <p>
        <Link href="/account#rubriques" className={uiBackLink}>
          Rubriques (carte & stock) →
        </Link>
      </p>

      <div>
        <h2 className={`mb-3 ${uiSectionTitle}`}>Liste des composants</h2>
        {!items?.length ? (
          <p className={uiLead}>Aucun composant. Créez-en un ci-dessus.</p>
        ) : (
          <InventoryCategoryTiles
            roots={prunedRoots}
            directMap={directMap}
            uncategorized={uncategorized}
          />
        )}
      </div>
    </div>
  );
}
