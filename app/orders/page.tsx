import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getPurchaseOrders } from "@/lib/db";
import { cachedGetSuppliers } from "@/lib/cache";
import { ClipboardList } from "lucide-react";
import { uiBadgeSlate, uiBtnPrimarySm } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_LABELS: Record<string, string> = {
  generated: "Créée",
  expected_delivery: "Livraison attendue",
  partially_received: "Partiellement reçue",
  received: "Reçue",
  cancelled: "Annulée",
};

export default async function OrdersPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [{ data: purchaseOrders }, { data: suppliers }] = await Promise.all([
    getPurchaseOrders(restaurant.id),
    cachedGetSuppliers(restaurant.id),
  ]);
  const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Achats & stock", href: "/achats" }, { label: "Commandes fournisseurs" }]}
        title="Commandes fournisseurs"
        subtitle="Commandes générées depuis les suggestions. Le stock n’est pas modifié à la création ; il sera mis à jour lors de la réception validée."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/orders/new" className={uiBtnPrimarySm}>
          Créer une commande
        </Link>
        <Link href="/orders/suggestions" className={uiBtnPrimarySm}>
          Voir les suggestions de commande
        </Link>
      </div>

      {!purchaseOrders || purchaseOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune commande pour le moment"
          description="Générez une commande depuis les suggestions d’achat, ou créez-en une manuellement."
          actionLabel="Voir les suggestions"
          actionHref="/orders/suggestions"
        />
      ) : (
        <ul className="space-y-2">
          {purchaseOrders.map((purchaseOrder) => (
            <li key={purchaseOrder.id}>
              <Link
                href={`/orders/${purchaseOrder.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-3.5 py-3 shadow-sm transition hover:border-copper-200 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                  <ClipboardList className="h-5 w-5 text-copper-700" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-stone-900 transition group-hover:text-copper-700">
                    {supplierById.get(purchaseOrder.supplier_id) ?? "Fournisseur"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-stone-500">
                    {purchaseOrder.created_at
                      ? new Date(purchaseOrder.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                </span>
                <span className={`${uiBadgeSlate} shrink-0`}>
                  {STATUS_LABELS[purchaseOrder.status] ?? purchaseOrder.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
