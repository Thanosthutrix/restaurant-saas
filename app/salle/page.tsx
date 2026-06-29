import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listDiningTables, listOpenDiningOrdersWithCustomerNames } from "@/lib/dining/diningDb";
import { diningTableTicketLineLabel } from "@/lib/dining/ticketLabel";
import { Armchair } from "lucide-react";
import { uiCard, uiLead, uiSectionTitleSm } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function SallePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [{ data: tables, error: tErr }, openOrdersRes] = await Promise.all([
    listDiningTables(restaurant.id),
    listOpenDiningOrdersWithCustomerNames(restaurant.id),
  ]);
  const oErr = openOrdersRes.error;

  if (tErr || oErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {tErr?.message ?? oErr?.message ?? "Erreur de chargement."}
        </p>
      </div>
    );
  }

  const orders = openOrdersRes.data.orders;
  const customerNameById = openOrdersRes.data.customerNameById;
  const openByTable = new Map(
    orders
      .filter((o) => o.dining_table_id != null)
      .map((o) => [
        o.dining_table_id as string,
        { orderId: o.id, customerId: o.customer_id as string | null },
      ])
  );
  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Salle" }]}
        title="Salle"
        subtitle="Tables actives et commandes en cours."
        actions={
          <Link
            href="/salle/tables"
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
          >
            Gérer les tables
          </Link>
        }
      />

      {!tables.length ? (
        <EmptyState
          icon={Armchair}
          title="Aucune table active"
          description="Créez vos tables pour commencer à prendre des commandes en salle."
          actionLabel="Ajouter des tables"
          actionHref="/salle/tables"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tables.map((t) => {
            const open = openByTable.get(t.id);
            const orderId = open?.orderId;
            const clientName =
              open?.customerId != null ? customerNameById.get(open.customerId) : undefined;
            const tableLineLabel = orderId
              ? diningTableTicketLineLabel(t.label, clientName)
              : t.label;
            return (
              <li key={t.id}>
                <Link
                  href={`/salle/table/${t.id}`}
                  className={`${uiCard} block transition hover:border-copper-100 hover:shadow-md`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`${uiSectionTitleSm} break-words`} title={tableLineLabel}>
                        {tableLineLabel}
                      </p>
                      <p className={`mt-1 ${uiLead}`}>
                        {orderId ? "Commande en cours — reprendre" : "Ouvrir une commande"}
                      </p>
                    </div>
                    {orderId ? (
                      <span className="inline-flex shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Ouverte
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 rounded-lg bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
                        Libre
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
