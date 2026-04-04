import Link from "next/link";
import { redirect } from "next/navigation";
import { getDishes, getDishComponents } from "@/lib/db";
import { findRecipeSuggestionForDish } from "@/lib/recipes/findRecipeSuggestionForDish";
import { getCurrentRestaurant } from "@/lib/auth";
import { getTemplateSuggestions } from "@/app/restaurants/actions";
import { CreateDishForm } from "./CreateDishForm";
import { DishListRow } from "./DishListRow";
import { DishTemplateSuggestionsBlock } from "./DishTemplateSuggestionsBlock";
import { uiBackLink, uiError, uiLead, uiPageTitle } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ name?: string; returnTo?: string }> };

export default async function DishesPage({ searchParams }: Props) {
  const restaurant = await getCurrentRestaurant();
  const params = await searchParams;
  const initialDishName = typeof params.name === "string" ? params.name : "";
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : "";
  if (!restaurant) redirect("/onboarding");

  const [{ data: dishes, error }, { suggestions }] = await Promise.all([
    getDishes(restaurant.id),
    getTemplateSuggestions(restaurant.id),
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

  const dishIds = (dishes ?? []).map((d) => d.id);
  const componentCounts = new Map<string, number>();
  await Promise.all(
    dishIds.map(async (dishId) => {
      const { data: comps } = await getDishComponents(dishId);
      componentCounts.set(dishId, (comps ?? []).length);
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

      <p>
        <Link href="/dishes/import-menu" className={uiBackLink}>
          Importer des plats depuis une photo de carte →
        </Link>
      </p>

      <DishTemplateSuggestionsBlock restaurantId={restaurant.id} suggestions={suggestions} />

      {!dishes?.length ? (
        <p className={uiLead}>
          Aucun plat. Créez-en depuis un service (ligne inconnue → + Nouveau plat) ou ajoutez une page de création si besoin.
        </p>
      ) : (
        <ul className="space-y-2">
          {(dishes ?? []).map((dish) => {
            const compCount = componentCounts.get(dish.id) ?? 0;
            const suggestionAvailable =
              (dish.recipe_status === "missing" || compCount === 0) &&
              findRecipeSuggestionForDish(dish.name) != null;
            return (
              <li key={dish.id}>
                <DishListRow
                  dish={dish}
                  compCount={compCount}
                  suggestionAvailable={suggestionAvailable}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
