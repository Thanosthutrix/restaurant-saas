import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getInventoryItems, getSuppliers } from "@/lib/db";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { ManualPurchaseOrderClient } from "./ManualPurchaseOrderClient";

export default async function NewPurchaseOrderPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [suppliersRes, itemsRes] = await Promise.all([
    getSuppliers(restaurant.id, true),
    getInventoryItems(restaurant.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <Link href="/orders" className={uiBackLink}>
        ← Commandes fournisseurs
      </Link>

      <div>
        <h1 className={uiPageTitle}>Créer une commande fournisseur</h1>
        <p className={`mt-2 ${uiLead}`}>
          Choisissez un fournisseur, recherchez les produits stock à commander, ajustez les quantités, puis créez la
          commande. Le message fournisseur est prérempli et reste modifiable avant envoi.
        </p>
      </div>

      <ManualPurchaseOrderClient
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        suppliers={suppliersRes.data ?? []}
        inventoryItems={itemsRes.data ?? []}
      />
    </div>
  );
}
