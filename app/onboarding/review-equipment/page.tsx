import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { uiAuthCard, uiLead, uiPageTitle } from "@/components/ui/premium";
import { ReviewEquipmentClient } from "./ReviewEquipmentClient";

export default async function OnboardingReviewEquipmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-6xl space-y-6">
        <div className="text-center">
          <h1 className={uiPageTitle}>Inventaire matériel détecté</h1>
          <p className={`mt-2 ${uiLead}`}>
            Validez le matériel cuisine et salle de {restaurant.name} pour préparer le PND hygiène et le plan de salle.
          </p>
        </div>
        <div className={uiAuthCard}>
          <ReviewEquipmentClient />
        </div>
      </div>
    </div>
  );
}
