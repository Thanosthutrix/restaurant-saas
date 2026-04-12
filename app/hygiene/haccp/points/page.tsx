import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { listTemperaturePoints } from "@/lib/haccpTemperature/haccpTemperatureDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { HaccpPointsClient } from "./HaccpPointsClient";

export default async function HaccpPointsPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const points = await listTemperaturePoints(restaurant.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <Link href="/hygiene/haccp" className={uiBackLink}>
          ← Températures HACCP
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Points de mesure</h1>
        <p className={`mt-2 ${uiLead}`}>
          Définissez les emplacements, types, seuils min/max et fréquence des relevés.
        </p>
      </div>

      <HaccpPointsClient restaurantId={restaurant.id} points={points} />
    </div>
  );
}
