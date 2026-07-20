import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { ReviewIngredientCategoriesClient } from "./ReviewIngredientCategoriesClient";

export default async function OnboardingReviewIngredientCategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <OnboardingPageShell
      accentIcon={Package}
      accentTone="bg-stone-100 text-stone-700"
      eyebrow="Étape suivante"
      subtitle="Validez les rubriques proposées pour vos ingrédients. Elles structurent le stock dans le même référentiel que la carte."
      title={`Rubriques composants stock : ${restaurant.name}`}
      width="wide"
    >
      <div className={uiCard}>
        <ReviewIngredientCategoriesClient />
      </div>
    </OnboardingPageShell>
  );
}
