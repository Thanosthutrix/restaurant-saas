import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { getInventoryItemsWithCalculatedStock, getSuppliers } from "@/lib/db";
import { computeOrderSuggestions } from "@/lib/orders/suggestions";
import { OrderSuggestionsClient } from "./OrderSuggestionsClient";

export default async function OrderSuggestionsPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const [itemsRes, suppliersRes] = await Promise.all([
    getInventoryItemsWithCalculatedStock(restaurant.id),
    getSuppliers(restaurant.id),
  ]);

  const items = itemsRes.data ?? [];
  const suppliers = (suppliersRes.data ?? []).filter((s) => s.is_active);
  const suggestions = computeOrderSuggestions(items, suppliers);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Tableau de bord
          </Link>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-slate-900">
          Commandes suggérées
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Composants sous le seuil ou le stock cible, regroupés par fournisseur. Les quantités sont calculées en unité de stock puis converties en unité d’achat via la conversion « 1 unité achetée = X unités de stock » (ex. stock en g, achat en kg avec ratio 1000, ou stock en kg et achat au kg avec ratio 1). Modifiez les quantités si besoin puis copiez le message.
        </p>

        <OrderSuggestionsClient
          suggestions={suggestions}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
        />

        <p className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/orders"
            className="text-sm text-slate-600 underline"
          >
            Historique des commandes
          </Link>
          <Link
            href="/suppliers"
            className="text-sm text-slate-600 underline"
          >
            Gérer les fournisseurs
          </Link>
        </p>
      </div>
    </div>
  );
}
