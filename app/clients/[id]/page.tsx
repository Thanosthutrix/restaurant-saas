import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getCustomerDiningHabitsReport } from "@/lib/customers/customerDiningHabits";
import {
  getCustomerById,
  listConsentLogs,
  listCustomerTags,
  listTimelineEvents,
} from "@/lib/customers/customersDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { ClientDetailClient } from "./ClientDetailClient";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const restaurant = await getRestaurantForPage();
  if (!restaurant) return { title: "Client" };
  const c = await getCustomerById(restaurant.id, id);
  return { title: c ? `${c.display_name} · Clients` : "Client" };
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [customer, tags, timeline, consentLogs, habitsRes] = await Promise.all([
    getCustomerById(restaurant.id, id),
    listCustomerTags(restaurant.id),
    listTimelineEvents(restaurant.id, id, 100),
    listConsentLogs(id, 80),
    getCustomerDiningHabitsReport(restaurant.id, id),
  ]);

  if (!customer) notFound();

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-8 px-4 py-6">
      <div>
        <Link href="/clients" className={uiBackLink}>
          ← Base clients
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>{customer.display_name}</h1>
        <p className={`mt-2 ${uiLead}`}>
          {customer.is_active ? (
            <span className="text-emerald-700">Fiche active</span>
          ) : (
            <span className="text-amber-800">Archivée</span>
          )}
          {customer.city ? (
            <>
              {" "}
              · {customer.city}
              {customer.country ? ` (${customer.country})` : ""}
            </>
          ) : null}
        </p>
      </div>

      <ClientDetailClient
        restaurantId={restaurant.id}
        customer={customer}
        allTags={tags}
        timeline={timeline}
        consentLogs={consentLogs}
        diningHabits={habitsRes.error ? null : habitsRes.data}
        diningHabitsError={habitsRes.error?.message ?? null}
      />
    </div>
  );
}
