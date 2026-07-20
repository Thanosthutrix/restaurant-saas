import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { ReviewRecipesClient } from "./ReviewRecipesClient";

export default async function OnboardingReviewRecipesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <OnboardingPageShell
      accentIcon={BookOpen}
      accentTone="bg-amber-50 text-amber-700"
      eyebrow="Étape suivante"
      subtitle="Validez ingrédients et quantités proposés. Les recettes seront créées en brouillon, sans impact stock tant qu'elles ne sont pas validées."
      title={`Vos recettes : ${restaurant.name}`}
      width="wide"
    >
      <div className={uiCard}>
        <ReviewRecipesClient />
      </div>
    </OnboardingPageShell>
  );
}
