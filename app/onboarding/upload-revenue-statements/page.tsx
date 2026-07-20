import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { UploadRevenueStatementsClient } from "./UploadRevenueStatementsClient";

export default async function UploadRevenueStatementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <OnboardingPageShell
      accentIcon={TrendingUp}
      accentTone="bg-cyan-50 text-cyan-700"
      breadcrumbs={[
        { label: "Tableau de bord", href: "/dashboard" },
        { label: "Historique de CA" },
      ]}
      subtitle={`Importez vos relevés pour ${restaurant.name}. Utile pour le pilotage et les analyses.`}
      title="Historique de CA"
    >
      <div className={uiCard}>
        <UploadRevenueStatementsClient />
      </div>
    </OnboardingPageShell>
  );
}
