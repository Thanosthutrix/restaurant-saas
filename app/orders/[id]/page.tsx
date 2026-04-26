import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getPurchaseOrder, getDeliveryNoteFileUrl } from "@/lib/db";
import { DeleteOrderButton } from "./DeleteOrderButton";
import { SupplierOrderSendPanel } from "./SupplierOrderSendPanel";

const STATUS_LABELS: Record<string, string> = {
  generated: "Créée",
  expected_delivery: "Livraison attendue",
  partially_received: "Partiellement reçue",
  received: "Reçue",
  cancelled: "Annulée",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { id } = await params;
  const { data: order, error } = await getPurchaseOrder(id);
  if (error || !order || order.restaurant_id !== restaurant.id) notFound();

  const supplierName = order.supplier?.name ?? "Fournisseur";
  const createdAt = order.created_at
    ? new Date(order.created_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <Link
            href="/orders"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Historique des commandes
          </Link>
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Commande {supplierName}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {createdAt} · {STATUS_LABELS[order.status] ?? order.status}
              </p>
              {order.expected_delivery_date && (
                <p className="mt-1 text-sm text-slate-600">
                  Livraison prévue :{" "}
                  {new Date(order.expected_delivery_date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <DeleteOrderButton orderId={order.id} restaurantId={restaurant.id} />
            </div>
          </div>
        </div>

        <SupplierOrderSendPanel
          orderId={order.id}
          restaurantId={restaurant.id}
          supplierName={supplierName}
          supplierEmail={order.supplier?.email ?? null}
          supplierPhone={order.supplier?.phone ?? null}
          supplierWhatsapp={order.supplier?.whatsapp_phone ?? null}
          preferredOrderMethod={order.supplier?.preferred_order_method ?? "EMAIL"}
          message={order.generated_message ?? ""}
          sentAt={order.sent_at}
          sentToEmail={order.sent_to_email}
          sentChannel={order.sent_channel}
        />

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">
            Lignes de commande
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-2">Article</th>
                  <th className="pb-2 pr-2 text-right">Quantité</th>
                  <th className="pb-2">Unité</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-medium text-slate-800">
                      {line.item_name_snapshot}
                      {line.supplier_sku_snapshot ? (
                        <span className="ml-1 text-slate-500">
                          (réf. {line.supplier_sku_snapshot})
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-right text-slate-600">
                      {line.ordered_qty_purchase_unit}
                    </td>
                    <td className="py-2 text-slate-600">
                      {line.purchase_unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {order.generated_message ? (
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-500">
              Message généré
            </h2>
            <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 font-mono text-sm text-slate-800">
              {order.generated_message}
            </pre>
          </section>
        ) : null}

        {order.delivery_notes.length > 0 ? (
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-500">
              Bons de livraison
            </h2>
            <ul className="space-y-2">
              {order.delivery_notes.map((dn) => {
                const fileUrl = dn.file_url ?? getDeliveryNoteFileUrl(dn.file_path);
                return (
                  <li key={dn.id}>
                    {fileUrl ? (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-700 underline"
                      >
                        {dn.file_name ?? "Bon de livraison"}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-700">
                        {dn.file_name ?? "Bon de livraison"}
                      </span>
                    )}
                    <span className="ml-2 text-xs text-slate-500">
                      {dn.created_at
                        ? new Date(dn.created_at).toLocaleDateString("fr-FR")
                        : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <p className="text-sm text-slate-500">
          <Link href={`/suppliers/${order.supplier_id}`} className="underline">
            Voir la fiche fournisseur
          </Link>
        </p>
      </div>
    </div>
  );
}
