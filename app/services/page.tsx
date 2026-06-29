import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getServicesForRestaurant, getServiceSalesAggregate } from "@/lib/db";
import { CalendarDays } from "lucide-react";
import { uiBackLink, uiError } from "@/components/ui/premium";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

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
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { data: services, error } = await getServicesForRestaurant(restaurant.id, 50, { summaryOnly: true });
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
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Pilotage", href: "/pilotage" }, { label: "Historique services" }]}
        title="Historique des services"
        subtitle={restaurant.name}
      />

      {!services?.length ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucun service enregistré"
          description="Créez un service depuis le tableau de bord pour suivre vos ventes et vos marges."
          actionLabel="Nouveau service"
          actionHref="/service/new"
        />
      ) : (
        <ul className="space-y-2">
          {services.map((service) => {
            const agg = aggregates?.get(service.id) ?? { lines: 0, totalQty: 0 };
            return (
              <li key={service.id}>
                <Link
                  href={`/service/${service.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-3.5 py-3 shadow-sm transition hover:border-copper-200 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                    <CalendarDays className="h-5 w-5 text-copper-700" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-stone-900 transition group-hover:text-copper-700">
                      {formatDate(service.service_date)} — {formatServiceType(service.service_type)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-stone-500">
                      {agg.lines} ligne{agg.lines !== 1 ? "s" : ""} · {agg.totalQty} vendu{agg.totalQty !== 1 ? "s" : ""}
                    </span>
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
    </PageContainer>
  );
}
