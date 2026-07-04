import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getInventoryItemsWithCalculatedStock, getSuppliers } from "@/lib/db";
import { computeOrderSuggestions } from "@/lib/orders/suggestions";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { uiBackLink } from "@/components/ui/premium";
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
    <PageContainer>
      <PageHeader
        accentIcon={Sparkles}
        accentTone="bg-amber-50 text-amber-700"
        breadcrumbs={[{ label: "Achats & stock", href: "/achats" }, { label: "Suggestions d’achat" }]}
        title="Commandes suggérées"
        subtitle="Composants sous le seuil ou le stock cible, regroupés par fournisseur. Les quantités (unité de stock) sont converties en unité d’achat via la conversion « 1 unité achetée = X unités de stock ». Ajustez si besoin, puis générez la commande ou copiez le message."
      />

      <OrderSuggestionsClient
        suggestions={suggestions}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        suppliers={suppliers}
        inventoryItems={items}
      />

      <p className="flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/orders" className={uiBackLink}>
          Historique des commandes
        </Link>
        <Link href="/suppliers" className={uiBackLink}>
          Gérer les fournisseurs
        </Link>
      </p>
    </PageContainer>
  );
}
