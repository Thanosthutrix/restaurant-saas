import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { getRestaurantTemplates } from "@/lib/templates/restaurantTemplates";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const owned = await getAccessibleRestaurantsForUser(user.id);
  if (owned.length > 0) redirect("/dashboard");

  const templates = getRestaurantTemplates();

  return (
    <OnboardingPageShell
      accentIcon={Sparkles}
      eyebrow="Première configuration"
      subtitle="Choisissez votre type d'établissement : le modèle applique automatiquement les composants stock et les plats suggérés. Vous pourrez tout ajuster ensuite."
      title="Créez votre restaurant"
    >
      <OnboardingForm templates={templates} />
    </OnboardingPageShell>
  );
}
