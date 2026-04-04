import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { getServicesForRestaurant, getServiceSalesAggregate } from "@/lib/db";
import { uiBackLink, uiError, uiLead, uiListRow, uiPageTitle } from "@/components/ui/premium";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatServiceType(type: string) {
  return type === "lunch" ? "Déjeuner" : "Dîner";
}

export default async function ServicesHistoryPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const { data: services, error } = await getServicesForRestaurant(restaurant.id);
  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className={uiError}>{error.message}</p>
      </div>
    );
  }

  const ids = (services ?? []).map((s) => s.id);
  const { data: aggregates } = await getServiceSalesAggregate(ids);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Historique des services</h1>
        <p className={`mt-2 ${uiLead}`}>{restaurant.name}</p>
      </div>

      {!services?.length ? (
        <p className={`rounded-2xl border border-slate-100 bg-white p-4 text-sm shadow-sm ${uiLead}`}>
          Aucun service enregistré. Créez un service depuis le tableau de bord.
        </p>
      ) : (
        <ul className="space-y-2">
          {services.map((service) => {
            const agg = aggregates?.get(service.id) ?? { lines: 0, totalQty: 0 };
            return (
              <li key={service.id}>
                <Link href={`/service/${service.id}`} className={uiListRow}>
                  <span className="font-semibold text-slate-900">
                    {formatDate(service.service_date)} — {formatServiceType(service.service_type)}
                  </span>
                  <span className="text-sm text-slate-500">
                    {agg.lines} ligne{agg.lines !== 1 ? "s" : ""} · {agg.totalQty} vendu{agg.totalQty !== 1 ? "s" : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p>
        <Link href="/service/new" className={uiBackLink}>
          Nouveau service
        </Link>
      </p>
    </div>
  );
}
