import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { countPendingTemperatureTasks, ensureTemperatureTasksForRestaurant } from "@/lib/haccpTemperature/haccpTemperatureDb";
import { uiBackLink, uiCard, uiLead, uiPageTitle, uiSectionTitleSm } from "@/components/ui/premium";

export default async function HaccpHubPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await ensureTemperatureTasksForRestaurant(restaurant.id, 14);
  const pendingCount = await countPendingTemperatureTasks(restaurant.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div>
        <Link href="/hygiene" className={uiBackLink}>
          ← Nettoyage
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Températures HACCP</h1>
        <p className={`mt-2 ${uiLead}`}>
          Points de mesure, relevés planifiés, anomalies et registre pour contrôle.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className={uiSectionTitleSm}>Accès</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <Link
              href="/hygiene/haccp/points"
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
            >
              Points de mesure
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/haccp/check"
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
            >
              Relevés à faire
              {pendingCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  {pendingCount}
                </span>
              )}
            </Link>
          </li>
          <li className="sm:col-span-2">
            <Link
              href="/hygiene/haccp/registre"
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
            >
              Registre des relevés
            </Link>
          </li>
        </ul>
      </section>

      <p className="text-xs text-slate-500">
        Les seuils et la marge d’« alerte » (proche limite) sont configurables par point. Les actions correctives sont
        exigées si la mesure est en alerte ou critique.
      </p>
    </div>
  );
}
