import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { CustomerNewClient } from "./CustomerNewClient";

export const metadata = { title: "Nouvelle fiche client" };

export default async function NewCustomerPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6 px-4 py-6">
      <div>
        <Link href="/clients" className={uiBackLink}>
          ← Base clients
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Nouvelle fiche</h1>
        <p className={`mt-2 ${uiLead}`}>
          Collectez uniquement les données utiles au service et respectez le RGPD (information des personnes,
          consentements explicites pour le marketing).
        </p>
      </div>
      <CustomerNewClient restaurantId={restaurant.id} />
    </div>
  );
}
