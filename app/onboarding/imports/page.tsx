import { redirect } from "next/navigation";
import { ScanLine } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getSuppliers } from "@/lib/db";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { OnboardingImportsClient } from "./OnboardingImportsClient";

export default async function OnboardingImportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");
  const { data: suppliers } = await getSuppliers(restaurant.id, true);

  return (
    <OnboardingPageShell
      accentIcon={ScanLine}
      accentTone="bg-violet-50 text-violet-700"
      breadcrumbs={[
        { label: "Tableau de bord", href: "/dashboard" },
        { label: "Assistant d'import IA" },
      ]}
      subtitle={`Complétez ${restaurant.name} sans tout saisir à la main : imports rejouables pour factures, tarifs et fiches fournisseurs.`}
      title="Assistant d'import IA"
    >
      <div className={uiCard}>
        <OnboardingImportsClient suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </OnboardingPageShell>
  );
}
