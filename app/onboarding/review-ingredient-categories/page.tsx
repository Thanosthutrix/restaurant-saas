import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { uiAuthCard, uiLead, uiPageTitle } from "@/components/ui/premium";
import { ReviewIngredientCategoriesClient } from "./ReviewIngredientCategoriesClient";

export default async function OnboardingReviewIngredientCategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className={uiPageTitle}>Rubriques composants stock : {restaurant.name}</h1>
          <p className={`mt-2 ${uiLead}`}>
            Validez les rubriques proposées pour vos ingrédients (issues de l’analyse des recettes). Elles structurent la
            liste des composants dans le même référentiel que les rubriques carte. Si tous les composants concernés sont
            des articles de revente, les rubriques créées ou mises à jour sont partagées avec la carte.
          </p>
        </div>
        <div className={uiAuthCard}>
          <ReviewIngredientCategoriesClient />
        </div>
      </div>
    </div>
  );
}
