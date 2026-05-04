import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getInventoryItem, getInventoryItemComponents, getInventoryItems, getSuppliers } from "@/lib/db";
import { computePrepFoodCostHt } from "@/lib/margins/dishMarginAnalysis";
import { RecipeFoodCostSection } from "@/components/margins/RecipeFoodCostSection";
import { getFifoSummaryForInventoryItem } from "@/lib/stock/fifo";
import { getPurchasePriceStatsForItem } from "@/lib/stock/purchasePriceHistory";
import { getCalculatedStockForSingleItem } from "@/lib/stock/stockMovements";
import { findRecipeSuggestionForPrep } from "@/lib/recipes/findRecipeSuggestionForPrep";
import { getRestaurantForPage } from "@/lib/auth";
import {
  buildCategoryTree,
  categoryPathLabel,
  flattenCategoryOptionsForSelect,
  listRestaurantCategories,
} from "@/lib/catalog/restaurantCategories";
import { ApplyBenchmarkTariffButton } from "./ApplyBenchmarkTariffButton";
import { EditInventoryItemBlock } from "./EditInventoryItemBlock";
import { InventoryCategoryBlock } from "./InventoryCategoryBlock";
import { FifoStockBlock } from "./FifoStockBlock";
import { PurchasePriceSection } from "./PurchasePriceSection";
import { InventoryItemSupplierBlock } from "./InventoryItemSupplierBlock";
import { PrepComponentsBlock } from "../PrepComponentsBlock";
import { PrepRecipeSuggestionBlock } from "../PrepRecipeSuggestionBlock";
import { ValidatePrepRecipeButton } from "../ValidatePrepRecipeButton";
import { DeleteInventoryItemButton } from "./DeleteInventoryItemButton";
import { uiBackLink, uiCard, uiLead } from "@/components/ui/premium";

type Props = { params: Promise<{ id: string }> };

const TYPE_LABELS: Record<string, string> = {
  ingredient: "Matière première",
  prep: "Préparation",
  resale: "Revente",
};

const RECIPE_STATUS_LABELS: Record<string, string> = {
  missing: "Sans recette",
  draft: "Brouillon",
  validated: "Validée",
};

export default async function InventoryItemDetailPage({ params }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { id } = await params;
  const [itemRes, componentsRes, allItemsRes, suppliersRes, calcRes, fifoRes, priceStatsRes, catRes] =
    await Promise.all([
      getInventoryItem(id),
      getInventoryItemComponents(id),
      getInventoryItems(restaurant.id),
      getSuppliers(restaurant.id),
      getCalculatedStockForSingleItem(restaurant.id, id),
      getFifoSummaryForInventoryItem(restaurant.id, id),
      getPurchasePriceStatsForItem(restaurant.id, id),
      listRestaurantCategories(restaurant.id),
    ]);

  if (itemRes.error || !itemRes.data) notFound();
  const item = itemRes.data;
  if (item.restaurant_id !== restaurant.id) notFound();

  const components = componentsRes.data ?? [];
  const allItems = allItemsRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];
  const isPrep = item.item_type === "prep";
  const suggestion = isPrep ? findRecipeSuggestionForPrep(item.name) : null;
  const hasNoComponents = components.length === 0;
  const showSuggestionBlock = isPrep && hasNoComponents && suggestion != null;
  const status = isPrep ? (item.recipe_status ?? (hasNoComponents ? "missing" : "draft")) : null;
  const statusLabel = status ? RECIPE_STATUS_LABELS[status] ?? status : null;
  const stockFromMovements = calcRes.error ? null : calcRes.qty;
  const stockMismatch =
    stockFromMovements != null &&
    Math.abs((item.current_stock_qty ?? 0) - stockFromMovements) > 1e-5;

  const prepCostRes =
    isPrep && components.length > 0
      ? await computePrepFoodCostHt(restaurant.id, item.id)
      : null;

  const flatCats = catRes.data ?? [];
  const invCatTree = buildCategoryTree(flatCats);
  const invCatOptions = flattenCategoryOptionsForSelect(invCatTree, "inventory");
  const invCategoryPath = categoryPathLabel(item.category_id, flatCats);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Link href="/inventory" className={uiBackLink}>
          ← Composants stockés
        </Link>
      </div>

      <div className={uiCard}>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{item.name}</h1>
        <p className={`mt-1 ${uiLead}`}>
          {TYPE_LABELS[item.item_type] ?? item.item_type} · {item.unit}
          {" · Stock : "}
          {stockFromMovements != null ? (
            <>
              <span className={stockMismatch ? "font-semibold text-amber-800" : ""}>
                {stockFromMovements}
              </span>
              {stockMismatch ? (
                <>
                  {" "}
                  (fiche : {item.current_stock_qty ?? 0}) · écart
                </>
              ) : null}
            </>
          ) : (
            <>{item.current_stock_qty ?? 0}</>
          )}
          {calcRes.error != null && " · (mouvements indisponibles)"}
          {item.min_stock_qty != null ? ` · Seuil min : ${item.min_stock_qty}` : ""}
          {statusLabel != null && ` · Recette : ${statusLabel}`}
        </p>
      </div>

      <InventoryCategoryBlock
        restaurantId={restaurant.id}
        itemId={item.id}
        options={invCatOptions}
        initialCategoryId={item.category_id ?? null}
        categoryPath={invCategoryPath}
      />

      <EditInventoryItemBlock
        item={item}
        restaurantId={restaurant.id}
        initialStockQty={stockFromMovements ?? item.current_stock_qty ?? 0}
      />

      {!isPrep ? (
        <ApplyBenchmarkTariffButton
          restaurantId={restaurant.id}
          itemId={item.id}
          itemType={item.item_type}
          referencePurchaseUnitCostHt={item.reference_purchase_unit_cost_ht ?? null}
          referencePurchaseIsBenchmark={item.reference_purchase_is_benchmark === true}
        />
      ) : null}

      <FifoStockBlock
        stockUnit={item.unit}
        summary={fifoRes.data}
        fifoError={fifoRes.error?.message ?? null}
      />

      <PurchasePriceSection
        stockUnit={item.unit}
        stats={priceStatsRes.data}
        error={priceStatsRes.error?.message ?? null}
        referenceUnitCostHt={item.reference_purchase_unit_cost_ht ?? null}
        referenceIsBenchmark={item.reference_purchase_is_benchmark === true}
      />

      <InventoryItemSupplierBlock
        item={item}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        restaurantId={restaurant.id}
      />

      {isPrep && showSuggestionBlock && suggestion && (
        <PrepRecipeSuggestionBlock
          inventoryItemId={item.id}
          parentItemId={item.id}
          restaurantId={restaurant.id}
          suggestion={suggestion}
          allItems={allItems}
        />
      )}

      {isPrep && (
        <PrepComponentsBlock
          parentItem={item}
          components={components}
          allItems={allItems}
          restaurantId={restaurant.id}
        />
      )}

      {prepCostRes != null && (
        <RecipeFoodCostSection
          title="Coût matière de la recette"
          footnote={`Pour 1 ${item.unit} produit (préparation dépliée en matières premières).`}
          result={prepCostRes}
        />
      )}

      {isPrep && components.length > 0 && status !== "validated" && (
        <ValidatePrepRecipeButton inventoryItemId={item.id} restaurantId={restaurant.id} />
      )}

      {!isPrep && (
        <p className={uiLead}>
          Seules les préparations ont une liste de composants. Ce composant peut être utilisé dans une préparation ou dans un plat.
        </p>
      )}

      <DeleteInventoryItemButton itemId={item.id} restaurantId={restaurant.id} itemName={item.name} />
    </div>
  );
}
