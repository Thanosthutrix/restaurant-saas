import { redirect } from "next/navigation";
import { getDishes } from "@/lib/db";
import { getRestaurantForPage } from "@/lib/auth";
import { NewServiceForm } from "./NewServiceForm";

export default async function NewServicePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: dishes, error } = await getDishes(restaurant.id);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-medium">Erreur lors du chargement des plats</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NewServiceForm restaurantId={restaurant.id} dishes={dishes ?? []} />
    </div>
  );
}
