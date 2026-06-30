import { redirect } from "next/navigation";
import { cachedGetDishes } from "@/lib/cache";
import { getRestaurantForPage } from "@/lib/auth";
import { NewServiceForm } from "./NewServiceForm";

export default async function NewServicePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: dishes, error } = await cachedGetDishes(restaurant.id);

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
        <p className="font-medium">Erreur lors du chargement des plats</p>
        <p className="mt-1 text-sm">{error.message}</p>
      </div>
    );
  }

  return <NewServiceForm restaurantId={restaurant.id} dishes={dishes ?? []} />;
}
