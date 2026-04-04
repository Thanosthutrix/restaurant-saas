import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { getPurchaseOrders, getSuppliers } from "@/lib/db";
import { uiBackLink, uiBadgeSlate, uiBtnPrimarySm, uiCard, uiLead, uiListRow, uiPageTitle } from "@/components/ui/premium";

const STATUS_LABELS: Record<string, string> = {
  generated: "Créée",
  expected_delivery: "Livraison attendue",
  partially_received: "Partiellement reçue",
  received: "Reçue",
  cancelled: "Annulée",
};

export default async function OrdersPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const { data: purchaseOrders } = await getPurchaseOrders(restaurant.id);
  const { data: suppliers } = await getSuppliers(restaurant.id);
  const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
      </div>

      <div>
        <h1 className={uiPageTitle}>Historique des commandes fournisseurs</h1>
        <p className={`mt-2 ${uiLead}`}>
          Commandes générées depuis les suggestions. Le stock n’est pas modifié à la création ; il sera mis à jour lors de la réception validée.
        </p>
      </div>

      <div>
        <Link href="/orders/suggestions" className={uiBtnPrimarySm}>
          Voir les suggestions de commande
        </Link>
      </div>

      {!purchaseOrders || purchaseOrders.length === 0 ? (
        <div className={uiCard}>
          <p className="text-slate-600">
            Aucune commande pour le moment. Générez une commande depuis la page des suggestions.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {purchaseOrders.map((purchaseOrder) => (
            <li key={purchaseOrder.id}>
              <Link href={`/orders/${purchaseOrder.id}`} className={uiListRow}>
                <div>
                  <span className="font-semibold text-slate-900">
                    {supplierById.get(purchaseOrder.supplier_id) ?? "Fournisseur"}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    {purchaseOrder.created_at
                      ? new Date(purchaseOrder.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={uiBadgeSlate}>{STATUS_LABELS[purchaseOrder.status] ?? purchaseOrder.status}</span>
                  <span className="text-slate-500">Voir la commande →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
