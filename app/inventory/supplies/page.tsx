import Link from "next/link";
import { redirect } from "next/navigation";
import { GlassWater, FolderTree } from "lucide-react";
import { getInventoryItemsWithCalculatedStock } from "@/lib/db";
import {
  buildCategoryTree,
  buildDirectItemsByCategoryId,
  filterCategoryTreeByIds,
  listRestaurantCategories,
  pruneCategoryTreeWithItems,
  visibleCategoryIdsWithAncestors,
} from "@/lib/catalog/restaurantCategories";
import { listRecentWasteLogs } from "@/lib/analysis/wasteDb";
import { getRestaurantForPage } from "@/lib/auth";
import { getNavAccessLevel } from "@/lib/auth/requireNavAccess";
import { isSupplyItemType } from "@/lib/inventory/inventoryItemTypes";
import { SuppliesPageClient } from "./SuppliesPageClient";
import { uiBtnSecondary } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

const QTY_EPS = 1e-5;

export default async function SuppliesInventoryPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");
  const access = await getNavAccessLevel("inventory");
  const canWrite = access === "full";

  const [{ data: items, error }, catRes, wasteRes] = await Promise.all([
    getInventoryItemsWithCalculatedStock(restaurant.id),
    listRestaurantCategories(restaurant.id),
    listRecentWasteLogs(restaurant.id, 20, { wasteType: "supply" }),
  ]);

  const list = (items ?? []).filter((i) => isSupplyItemType(i.item_type));
  const itemNames = Object.fromEntries(list.map((i) => [i.id, i.name]));

  let belowMinCount = 0;
  for (const item of list) {
    const min = item.min_stock_qty != null ? Number(item.min_stock_qty) : null;
    if (min == null || !Number.isFinite(min)) continue;
    const stock = item.stock_qty_from_movements ?? 0;
    if (stock < min - QTY_EPS) belowMinCount += 1;
  }

  const flatCats = catRes.data ?? [];
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
        accentIcon={GlassWater}
        accentTone="bg-sky-50 text-sky-700"
        breadcrumbs={[
          { label: "Achats & stock", href: "/achats" },
          { label: "Vaisselle & matériel" },
        ]}
        title="Vaisselle & matériel"
        subtitle="Verres, carafes, couverts et autres articles non consommables — stock, casse et réappro."
        actions={
          <Link href="/account#rubriques" className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}>
            <FolderTree className="h-4 w-4" aria-hidden />
            Rubriques
          </Link>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error.message}
        </div>
      )}

      <SuppliesPageClient
        restaurantId={restaurant.id}
        canWrite={canWrite}
        roots={prunedRoots}
        directMap={directMap}
        uncategorized={uncategorized}
        belowMinCount={belowMinCount}
        breakageLogs={wasteRes.data}
        itemNames={itemNames}
      />
    </PageContainer>
  );
}
