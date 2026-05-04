import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getSuppliers } from "@/lib/db";
import { uiAuthCard, uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { UploadSupplierDocumentsClient } from "./UploadSupplierDocumentsClient";

export default async function UploadSupplierDocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: suppliers } = await getSuppliers(restaurant.id, true);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <Link href="/dashboard" className={uiBackLink}>
            ← Tableau de bord
          </Link>
          <h1 className={`mt-4 ${uiPageTitle}`}>Tarifs et fournisseurs</h1>
          <p className={`mt-2 ${uiLead}`}>
            Étape suivante après les rubriques de carte : chargez vos dernières factures (et éventuellement des BL)
            pour {restaurant.name}. L’IA en extrait les montants et met à jour les fiches fournisseurs quand c’est
            possible.
          </p>
        </div>
        <div className={uiAuthCard}>
          <UploadSupplierDocumentsClient suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      </div>
    </div>
  );
}
