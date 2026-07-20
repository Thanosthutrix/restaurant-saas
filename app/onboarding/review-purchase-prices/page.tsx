import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getInventoryItems } from "@/lib/db";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { ReviewPurchasePricesClient } from "./ReviewPurchasePricesClient";

export default async function OnboardingReviewPurchasePricesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: inventory } = await getInventoryItems(restaurant.id);

  return (
    <OnboardingPageShell
      accentIcon={Receipt}
      accentTone="bg-emerald-50 text-emerald-700"
      eyebrow="Étape suivante"
      subtitle={`Validez les prix lus sur les factures pour initialiser les coûts ingrédients de ${restaurant.name}.`}
      title="Tarifs d'achat détectés"
      width="wide"
    >
      <div className={uiCard}>
        <ReviewPurchasePricesClient
          inventory={(inventory ?? []).map((item) => ({ id: item.id, name: item.name, unit: item.unit }))}
        />
      </div>
    </OnboardingPageShell>
  );
}
