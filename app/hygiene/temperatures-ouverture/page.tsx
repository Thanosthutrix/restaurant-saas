import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { listColdHygieneElements, listColdTemperatureRegister } from "@/lib/hygiene/hygieneDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { HygieneColdTemperaturesClient } from "./HygieneColdTemperaturesClient";

export default async function HygieneTemperaturesPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const [coldElements, recentReadings] = await Promise.all([
    listColdHygieneElements(restaurant.id),
    listColdTemperatureRegister(restaurant.id, 15),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <Link href="/hygiene" className={uiBackLink}>
          ← Nettoyage
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Froid : ouverture & fermeture</h1>
        <p className={`mt-2 ${uiLead}`}>
          Pour chaque chambre froide, frigo ou congélateur, enregistrez la température à l’ouverture et à la fermeture.
          Les relevés sont conservés dans le registre dédié.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Support de traçabilité interne ; adaptez la fréquence et les seuils à votre procédure HACCP.
        </p>
      </div>

      <HygieneColdTemperaturesClient
        restaurantId={restaurant.id}
        coldElements={coldElements}
        recentReadings={recentReadings}
      />
    </div>
  );
}
