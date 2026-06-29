import Link from "next/link";
import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { cachedGetSuppliers } from "@/lib/cache";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateSupplierForm } from "./CreateSupplierForm";
import { SuppliersGrid } from "./SuppliersGrid";

export default async function SuppliersPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: suppliers, error } = await cachedGetSuppliers(restaurant.id);

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Achats & stock", href: "/achats" }, { label: "Fournisseurs" }]}
        title="Fournisseurs"
        subtitle="Coordonnées, jours de commande et canal préféré pour chaque fournisseur."
      />

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error.message}
          </div>
        )}

        <CreateSupplierForm restaurantId={restaurant.id} />

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-medium text-stone-800">
            Liste des fournisseurs
          </h2>
          {!suppliers?.length ? (
            <EmptyState
              icon={Truck}
              title="Aucun fournisseur"
              description="Ajoutez vos fournisseurs avec le formulaire ci-dessus pour préparer vos commandes."
            />
          ) : (
            <SuppliersGrid suppliers={suppliers} />
          )}
        </div>

        <p className="mt-6">
          <Link
            href="/orders/suggestions"
            className="text-sm text-stone-600 underline"
          >
            Voir les commandes suggérées
          </Link>
        </p>
    </PageContainer>
  );
}
