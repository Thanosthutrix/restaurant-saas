import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getInventoryItemsWithCalculatedStock, getSuppliers } from "@/lib/db";
import { computeOrderSuggestions } from "@/lib/orders/suggestions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { OrderSuggestionsClient } from "./OrderSuggestionsClient";

export default async function OrderSuggestionsPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [itemsRes, suppliersRes] = await Promise.all([
    getInventoryItemsWithCalculatedStock(restaurant.id),
    getSuppliers(restaurant.id),
  ]);

  const items = itemsRes.data ?? [];
  const suppliers = (suppliersRes.data ?? []).filter((s) => s.is_active);
  const suggestions = computeOrderSuggestions(items, suppliers);

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Achats & stock", href: "/achats" }, { label: "Suggestions d’achat" }]}
        title="Commandes suggérées"
        subtitle="Composants sous le seuil ou le stock cible, regroupés par fournisseur. Les quantités sont calculées en unité de stock puis converties en unité d’achat via la conversion « 1 unité achetée = X unités de stock » (ex. stock en g, achat en kg avec ratio 1000, ou stock en kg et achat au kg avec ratio 1). Modifiez les quantités si besoin puis copiez le message."
      />

        <OrderSuggestionsClient
          suggestions={suggestions}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
        />

        <p className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/orders/new"
            className="text-sm text-stone-600 underline"
          >
            Créer une commande manuelle
          </Link>
          <Link
            href="/orders"
            className="text-sm text-stone-600 underline"
          >
            Historique des commandes
          </Link>
          <Link
            href="/suppliers"
            className="text-sm text-stone-600 underline"
          >
            Gérer les fournisseurs
          </Link>
        </p>
    </PageContainer>
  );
}
