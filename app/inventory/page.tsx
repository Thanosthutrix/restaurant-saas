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
import { Boxes, FolderTree } from "lucide-react";
import { uiBtnSecondary, uiError, uiInfoBanner, uiSectionTitle } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";
import { EmptyState } from "@/components/ui/EmptyState";

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
    <PageContainer width="narrow">
      <PageHeader
        accentIcon={SECTION_ACCENT.inventory.icon}
        accentTone={SECTION_ACCENT.inventory.tone}
        breadcrumbs={[{ label: "Achats & stock", href: "/achats" }, { label: "Stock" }]}
        title="Composants stockés"
        subtitle="Matières premières, préparations intermédiaires, articles en revente."
        actions={
          <Link href="/account#rubriques" className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}>
            <FolderTree className="h-4 w-4" aria-hidden />
            Rubriques
          </Link>
        }
      />

      <p className={uiInfoBanner}>
        <span className="font-semibold text-stone-800">Stock</span> = somme des mouvements (réceptions, consommations
        services, ajustements). Si la valeur de la fiche diffère, elle est indiquée entre parenthèses jusqu’à convergence (ex. données
        anciennes sans historique de mouvements).
      </p>

      {error && <div className={uiError}>{error.message}</div>}

      {canWrite && <CreateInventoryItemForm restaurantId={restaurant.id} />}

      <div>
        <h2 className={`mb-3 ${uiSectionTitle}`}>Liste des composants</h2>
        {!items?.length ? (
          <EmptyState
            icon={Boxes}
            title="Aucun composant pour l’instant"
            description="Ajoutez vos matières premières et préparations avec le formulaire ci-dessus pour suivre votre stock."
          />
        ) : (
          <InventoryCategoryTiles
            roots={prunedRoots}
            directMap={directMap}
            uncategorized={uncategorized}
          />
        )}
      </div>
    </PageContainer>
  );
}
