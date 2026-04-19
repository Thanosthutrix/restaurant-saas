import { redirect } from "next/navigation";
import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { getRestaurantTemplates } from "@/lib/templates/restaurantTemplates";
import { OnboardingForm } from "./OnboardingForm";
import { uiAuthCard, uiLead, uiPageTitle } from "@/components/ui/premium";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const owned = await getAccessibleRestaurantsForUser(user.id);
  if (owned.length > 0) redirect("/dashboard");

  const templates = getRestaurantTemplates();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className={uiPageTitle}>Créez votre restaurant</h1>
          <p className={`mt-2 ${uiLead}`}>
            Le type d&apos;établissement choisi applique automatiquement le modèle de composants stock et les plats
            suggérés correspondants.
          </p>
        </div>
        <div className={uiAuthCard}>
          <OnboardingForm templates={templates} />
        </div>
      </div>
    </div>
  );
}
