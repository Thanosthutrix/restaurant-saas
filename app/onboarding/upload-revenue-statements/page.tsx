import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { uiAuthCard, uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { UploadRevenueStatementsClient } from "./UploadRevenueStatementsClient";

export default async function UploadRevenueStatementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <Link href="/dashboard" className={uiBackLink}>
            ← Tableau de bord
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>Historique de CA</h1>
          <p className={`mt-2 ${uiLead}`}>
            Importez vos relevés pour {restaurant.name} (même logique que l’assistant IA). Utile pour le pilotage et
            les analyses, sans lier automatiquement chaque ligne à votre carte actuelle.
          </p>
        </div>
        <div className={uiAuthCard}>
          <UploadRevenueStatementsClient />
        </div>
      </div>
    </div>
  );
}
