import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getSuppliers } from "@/lib/db";
import { uiAuthCard, uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { OnboardingImportsClient } from "./OnboardingImportsClient";

export default async function OnboardingImportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");
  const { data: suppliers } = await getSuppliers(restaurant.id, true);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Assistant d’import IA</h1>
        <p className={`mt-2 ${uiLead}`}>
          Rejouez les étapes utiles de l’onboarding pour {restaurant.name}, sans recréer le restaurant.
        </p>
      </div>
      <div className={uiAuthCard}>
        <OnboardingImportsClient suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </div>
  );
}
