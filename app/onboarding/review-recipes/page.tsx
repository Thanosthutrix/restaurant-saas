import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { uiAuthCard, uiLead, uiPageTitle } from "@/components/ui/premium";
import { ReviewRecipesClient } from "./ReviewRecipesClient";

export default async function OnboardingReviewRecipesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center">
          <h1 className={uiPageTitle}>Vos recettes : {restaurant.name}</h1>
          <p className={`mt-2 ${uiLead}`}>
            Validez les ingrédients et quantités proposés. Les recettes seront créées en brouillon, sans impact stock
            tant qu’elles ne sont pas validées.
          </p>
        </div>
        <div className={uiAuthCard}>
          <ReviewRecipesClient />
        </div>
      </div>
    </div>
  );
}
