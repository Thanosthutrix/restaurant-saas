import { notFound, redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getCustomerDiningHabitsReport } from "@/lib/customers/customerDiningHabits";
import {
  getCustomerById,
  listConsentLogs,
  listCustomerTags,
  listTimelineEvents,
} from "@/lib/customers/customersDb";
import { ClientDetailClient } from "../../[id]/ClientDetailClient";
import { ClientDetailModal } from "../../[id]/ClientDetailModal";

type Props = { params: Promise<{ id: string }> };

/**
 * Route d'interception : ouvre la fiche client en modale lors d'une navigation
 * depuis la liste. Un accès direct ou un refresh affiche la page complète.
 */
export default async function InterceptedClientDetail({ params }: Props) {
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

  const subtitle = (
    <>
      {customer.is_active ? "Fiche active" : "Archivée"}
      {customer.city ? ` · ${customer.city}${customer.country ? ` (${customer.country})` : ""}` : ""}
    </>
  );

  return (
    <ClientDetailModal name={customer.display_name} subtitle={subtitle}>
      <ClientDetailClient
        restaurantId={restaurant.id}
        customer={customer}
        allTags={tags}
        timeline={timeline}
        consentLogs={consentLogs}
        diningHabits={habitsRes.error ? null : habitsRes.data}
        diningHabitsError={habitsRes.error?.message ?? null}
      />
    </ClientDetailModal>
  );
}
