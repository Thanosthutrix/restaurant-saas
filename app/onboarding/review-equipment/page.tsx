import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { ReviewEquipmentClient } from "./ReviewEquipmentClient";

export default async function OnboardingReviewEquipmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <OnboardingPageShell
      accentIcon={Wrench}
      accentTone="bg-violet-50 text-violet-700"
      eyebrow="Étape suivante"
      subtitle={`Validez le matériel cuisine et salle de ${restaurant.name} pour préparer le PND hygiène et le plan de salle.`}
      title="Inventaire matériel détecté"
      width="wide"
    >
      <div className={uiCard}>
        <ReviewEquipmentClient />
      </div>
    </OnboardingPageShell>
  );
}
