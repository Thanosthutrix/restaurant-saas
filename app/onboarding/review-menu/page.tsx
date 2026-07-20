import { redirect } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { ReviewMenuClient } from "./ReviewMenuClient";

export default async function OnboardingReviewMenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <OnboardingPageShell
      accentIcon={UtensilsCrossed}
      accentTone="bg-emerald-50 text-emerald-700"
      eyebrow="Étape suivante"
      subtitle="L'analyse est terminée. Validez les plats à créer — rien n'est enregistré sans votre confirmation."
      title={`Votre carte : ${restaurant.name}`}
      width="wide"
    >
      <div className={uiCard}>
        <ReviewMenuClient />
      </div>
    </OnboardingPageShell>
  );
}
