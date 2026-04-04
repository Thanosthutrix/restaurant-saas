import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentRestaurant } from "@/lib/auth";
import { ReviewMenuClient } from "./ReviewMenuClient";
import { uiAuthCard, uiLead, uiPageTitle } from "@/components/ui/premium";

/**
 * Étape après création du restaurant avec photos de carte : ne pas rediriger vers le dashboard
 * tant que l’utilisateur n’a pas validé (évite le redirect de /onboarding dès que le cookie existe).
 */
export default async function OnboardingReviewMenuPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className={uiPageTitle}>Votre carte : {restaurant.name}</h1>
          <p className={`mt-2 ${uiLead}`}>
            L’analyse est terminée. Validez les plats à créer dans votre espace — ils ne sont pas encore enregistrés.
          </p>
        </div>
        <div className={uiAuthCard}>
          <ReviewMenuClient />
        </div>
      </div>
    </div>
  );
}
