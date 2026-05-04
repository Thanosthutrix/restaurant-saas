import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getInventoryItems } from "@/lib/db";
import { uiAuthCard, uiLead, uiPageTitle } from "@/components/ui/premium";
import { ReviewPurchasePricesClient } from "./ReviewPurchasePricesClient";

export default async function OnboardingReviewPurchasePricesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: inventory } = await getInventoryItems(restaurant.id);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl space-y-6">
        <div className="text-center">
          <h1 className={uiPageTitle}>Tarifs d’achat détectés</h1>
          <p className={`mt-2 ${uiLead}`}>
            Validez les prix lus sur les factures pour initialiser les coûts ingrédients de {restaurant.name}. Pour chaque
            nouvel ingrédient, vous pouvez lier une ligne de la base indicative France avant d’enregistrer le tarif
            facture comme référence réelle.
          </p>
        </div>
        <div className={uiAuthCard}>
          <ReviewPurchasePricesClient
            inventory={(inventory ?? []).map((item) => ({ id: item.id, name: item.name, unit: item.unit }))}
          />
        </div>
      </div>
    </div>
  );
}
