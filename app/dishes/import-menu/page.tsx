import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { ImportMenuClient } from "./ImportMenuClient";

export default async function ImportMenuPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ImportMenuClient restaurantId={restaurant.id} />
    </div>
  );
}
