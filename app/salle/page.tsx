import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getRestaurantForPage } from "@/lib/auth";
import { listDiningTables, listOpenDiningOrdersWithCustomerNames } from "@/lib/dining/diningDb";
import { diningOrderGuestDisplayName } from "@/lib/dining/ticketLabel";
import { Armchair } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { type FloorTable } from "@/components/salle/InteractiveFloorPlan";
import { SalleOrderSessionLoader } from "./SalleOrderSessionLoader";

function SallePlanFallback() {
  return (
    <div className="min-h-[320px] animate-pulse rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video" />
  );
}

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
        {
          orderId: o.id,
          customerId: o.customer_id as string | null,
          guestLabel: o.notes?.trim() || null,
        },
      ])
  );
  const openCount = tables.filter((t) => openByTable.has(t.id)).length;
  const floorTables: FloorTable[] = tables.map((table, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      id: table.id,
      label: table.label,
      capacity: 4,
      x: 8 + column * 21,
      y: 12 + row * 20,
      width: 12,
      height: 12,
      rotation: 0,
      status: openByTable.has(table.id) ? "occupied" : "free",
    };
  });

  const tableSummaries = tables.map((t) => {
    const open = openByTable.get(t.id);
    const clientName = open
      ? diningOrderGuestDisplayName(
          open.customerId != null ? customerNameById.get(open.customerId) : undefined,
          open.guestLabel
        )
      : undefined;
    return { id: t.id, label: t.label, clientName: clientName ?? undefined };
  });

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
          <div className="flex flex-wrap gap-2">
            <Link
              href="/salle/plan"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Configurer le plan
            </Link>
            <Link
              href="/salle/tables"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Gérer les tables
            </Link>
          </div>
        }
      />

      <Suspense fallback={<SallePlanFallback />}>
        <SalleOrderSessionLoader
          restaurantId={restaurant.id}
          initialTables={floorTables}
          tableSummaries={tables.length > 0 ? tableSummaries : undefined}
        />
      </Suspense>

      {!tables.length ? (
        <EmptyState
          icon={Armchair}
          title="Aucune table active"
          description="Ce compte est rattaché à un restaurant sans table active. Le plan reste visible, mais créez des tables pour les retrouver dans toute la salle."
          actionLabel="Ajouter des tables"
          actionHref="/salle/tables"
        />
      ) : null}
    </PageContainer>
  );
}
