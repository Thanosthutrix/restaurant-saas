import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { ensureOpenDiningOrder } from "@/lib/dining/diningDb";

type Props = { params: Promise<{ tableId: string }> };

export default async function OpenTableOrderPage({ params }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { tableId } = await params;
  const { orderId, error } = await ensureOpenDiningOrder(restaurant.id, tableId);

  if (error || !orderId) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
          {error?.message ?? "Impossible d’ouvrir la commande pour cette table."}
        </p>
        <p className="mt-4">
          <a href="/salle" className="text-sm font-semibold text-copper-700 hover:text-copper-600">
            ← Retour à la salle
          </a>
        </p>
      </div>
    );
  }

  redirect(`/salle/commande/${orderId}`);
}
