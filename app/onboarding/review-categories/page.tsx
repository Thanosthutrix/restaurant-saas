import { redirect } from "next/navigation";
import { LayoutList } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { ReviewCategoriesClient } from "./ReviewCategoriesClient";

export default async function OnboardingReviewCategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <OnboardingPageShell
      accentIcon={LayoutList}
      accentTone="bg-cyan-50 text-cyan-700"
      eyebrow="Étape suivante"
      subtitle="Validez les rubriques carte proposées par l'analyse IA. Ensuite : factures fournisseur, relevés de CA, rubriques composants si besoin."
      title={`Rubriques de carte : ${restaurant.name}`}
      width="wide"
    >
      <div className={uiCard}>
        <ReviewCategoriesClient />
      </div>
    </OnboardingPageShell>
  );
}
