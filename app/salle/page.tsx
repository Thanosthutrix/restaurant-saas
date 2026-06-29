import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listDiningTables, listOpenDiningOrdersWithCustomerNames } from "@/lib/dining/diningDb";
import { Armchair } from "lucide-react";
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
  const openCount = tables.filter((t) => openByTable.has(t.id)).length;

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Salle" }]}
        title="Salle"
        subtitle={
          tables.length
            ? `${tables.length} table${tables.length > 1 ? "s" : ""} · ${openCount} ouverte${openCount > 1 ? "s" : ""}`
            : "Tables actives et commandes en cours."
        }
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tables.map((t) => {
            const open = openByTable.get(t.id);
            const occupied = open != null;
            const clientName =
              open?.customerId != null ? customerNameById.get(open.customerId) : undefined;
            return (
              <li key={t.id}>
                <Link
                  href={`/salle/table/${t.id}`}
                  className={`group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition hover:-translate-y-0.5 hover:shadow-md ${
                    occupied
                      ? "border-copper-300 bg-copper-50/60 ring-1 ring-copper-200"
                      : "border-stone-200/70 bg-white shadow-sm hover:border-copper-200"
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      occupied ? "bg-copper-100 text-copper-800" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    <Armchair className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="line-clamp-1 font-semibold text-stone-900" title={t.label}>
                    {t.label}
                  </span>
                  {occupied ? (
                    <span className="line-clamp-1 text-xs font-medium text-copper-800">
                      {clientName ?? "Commande en cours"}
                    </span>
                  ) : (
                    <span className="text-xs text-stone-400">Libre</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      occupied ? "bg-copper-700 text-white" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {occupied ? "Ouverte" : "Libre"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
