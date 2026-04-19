import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDish, getDishComponents, getInventoryItems } from "@/lib/db";
import { computeDishFoodCostHt } from "@/lib/margins/dishMarginAnalysis";
import { explodeDishComponents } from "@/lib/recipes/explodeDishComponents";
import { findRecipeSuggestionForDish } from "@/lib/recipes/findRecipeSuggestionForDish";
import { getRestaurantForPage } from "@/lib/auth";
import {
  buildCategoryTree,
  categoryPathLabel,
  flattenCategoryOptionsForSelect,
  listRestaurantCategories,
} from "@/lib/catalog/restaurantCategories";
import { normalizeVatRatePct } from "@/lib/tax/frenchSellingVat";
import { RecipeFoodCostSection } from "@/components/margins/RecipeFoodCostSection";
import { DishSellingPriceBlock } from "./DishSellingPriceBlock";
import { DishComponentsBlock } from "./DishComponentsBlock";
import { RecipeSuggestionBlock } from "./RecipeSuggestionBlock";
import { ValidateRecipeButton } from "./ValidateRecipeButton";
import { DeleteDishButton } from "./DeleteDishButton";
import { DishCategoryBlock } from "./DishCategoryBlock";
import { uiBackLink, uiCard, uiLead, uiMuted } from "@/components/ui/premium";

type Props = { params: Promise<{ id: string }> };

export default async function DishDetailPage({ params }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { id } = await params;
  const [dishRes, componentsRes, itemsRes, catRes] = await Promise.all([
    getDish(id),
    getDishComponents(id),
    getInventoryItems(restaurant.id),
    listRestaurantCategories(restaurant.id),
  ]);

  if (dishRes.error || !dishRes.data) notFound();
  const dish = dishRes.data;
  if (dish.restaurant_id !== restaurant.id) notFound();

  const components = componentsRes.data ?? [];
  const allItems = itemsRes.data ?? [];
  const suggestion = findRecipeSuggestionForDish(dish.name);
  const hasNoComponents = components.length === 0;
  const showSuggestionBlock = hasNoComponents && suggestion != null;
  const exploded = await explodeDishComponents(restaurant.id, id, { maxDepth: 5 });

  const costRes =
    components.length > 0 ? await computeDishFoodCostHt(restaurant.id, id) : null;
  const sellingTtcInitial =
    dish.selling_price_ttc != null &&
    Number.isFinite(Number(dish.selling_price_ttc)) &&
    Number(dish.selling_price_ttc) > 0
      ? Number(dish.selling_price_ttc)
      : null;
  const vatInitial = normalizeVatRatePct(dish.selling_vat_rate_pct, 10);
  const sellingHtInitial =
    dish.selling_price_ht != null &&
    Number.isFinite(Number(dish.selling_price_ht)) &&
    Number(dish.selling_price_ht) > 0
      ? Number(dish.selling_price_ht)
      : null;

  const status = dish.recipe_status ?? (hasNoComponents ? "missing" : "draft");
  const statusLabel =
    status === "validated" ? "Validée" : status === "draft" ? "Brouillon" : "Sans recette";

  const flatCats = catRes.data ?? [];
  const dishCatTree = buildCategoryTree(flatCats);
  const dishCatOptions = flattenCategoryOptionsForSelect(dishCatTree, "dish");
  const dishCategoryPath = categoryPathLabel(dish.category_id, flatCats);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Link href="/dishes" className={uiBackLink}>
          ← Plats vendus
        </Link>
      </div>

      <div className={uiCard}>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{dish.name}</h1>
        <p className={`mt-1 ${uiLead}`}>
          Mode : {dish.production_mode === "resale" ? "Revente" : dish.production_mode === "prepared" ? "Préparé" : "Non défini"}
          {" · "}
          Recette : {statusLabel}
        </p>
      </div>

      <DishCategoryBlock
        restaurantId={restaurant.id}
        dishId={dish.id}
        options={dishCatOptions}
        initialCategoryId={dish.category_id ?? null}
        categoryPath={dishCategoryPath}
      />

      <DishSellingPriceBlock
        dishId={dish.id}
        restaurantId={restaurant.id}
        initialSellingPriceTtc={sellingTtcInitial}
        initialVatRatePct={vatInitial}
        initialSellingPriceHt={sellingHtInitial}
        foodCostHt={
          costRes && !costRes.errorMessage && costRes.costIsComplete ? costRes.foodCostHt : null
        }
        costIsComplete={costRes ? costRes.costIsComplete && !costRes.errorMessage : true}
        foodCostError={costRes?.errorMessage ?? null}
      />

      {costRes != null && (
        <RecipeFoodCostSection
          title="Coût matière de la recette"
          footnote="Pour une portion vendue telle que définie par les quantités de la recette (composants dépliés)."
          result={costRes}
        />
      )}

      {showSuggestionBlock && suggestion && (
        <RecipeSuggestionBlock
          dishId={dish.id}
          restaurantId={restaurant.id}
          suggestion={suggestion}
        />
      )}

      <DishComponentsBlock
        dish={dish}
        components={components}
        allItems={allItems}
        restaurantId={restaurant.id}
      />

      {components.length > 0 && status !== "validated" && (
        <ValidateRecipeButton dishId={dish.id} restaurantId={restaurant.id} />
      )}

      <DeleteDishButton dishId={dish.id} restaurantId={restaurant.id} dishName={dish.name} />

      {exploded.length > 0 && (
        <div className={uiCard}>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Consommation dépliée (base pour stock)
          </h2>
          <p className={`mb-2 ${uiMuted}`}>Agrégation des composants finaux (préparations développées).</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {exploded.map((e) => (
              <li key={e.inventoryItemId}>
                {e.name} : {e.qty} {e.unit}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
