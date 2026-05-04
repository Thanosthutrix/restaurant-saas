import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { uiAuthCard, uiLead, uiPageTitle } from "@/components/ui/premium";
import { ReviewCategoriesClient } from "./ReviewCategoriesClient";

export default async function OnboardingReviewCategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className={uiPageTitle}>Rubriques de carte : {restaurant.name}</h1>
          <p className={`mt-2 ${uiLead}`}>
            Validez les rubriques carte proposées par l’analyse IA. Ensuite, vous pourrez charger des factures fournisseur
            (tarifs, fiches fournisseurs) puis des relevés de CA — comme dans l’assistant d’import. Si des recettes
            proposent des rubriques composants, une étape dédiée suivra. Si tous les plats concernés sont en revente,
            les rubriques créées seront aussi disponibles pour le stock.
          </p>
        </div>
        <div className={uiAuthCard}>
          <ReviewCategoriesClient />
        </div>
      </div>
    </div>
  );
}
