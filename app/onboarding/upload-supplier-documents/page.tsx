import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { getSuppliers } from "@/lib/db";
import { OnboardingPageShell } from "@/components/onboarding/OnboardingPageShell";
import { uiCard } from "@/components/ui/premium";
import { UploadSupplierDocumentsClient } from "./UploadSupplierDocumentsClient";

export default async function UploadSupplierDocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: suppliers } = await getSuppliers(restaurant.id, true);

  return (
    <OnboardingPageShell
      accentIcon={FileText}
      accentTone="bg-amber-50 text-amber-700"
      breadcrumbs={[
        { label: "Tableau de bord", href: "/dashboard" },
        { label: "Tarifs et fournisseurs" },
      ]}
      subtitle={`Chargez vos factures (et éventuellement des BL) pour ${restaurant.name}. L'IA en extrait montants et coordonnées fournisseurs.`}
      title="Tarifs et fournisseurs"
    >
      <div className={uiCard}>
        <UploadSupplierDocumentsClient suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </OnboardingPageShell>
  );
}
