import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getSupplier, getPurchaseOrders, getDeliveryNotesBySupplier, getDeliveryNoteFileUrl, getDeliveryNotesByPurchaseOrderIds, getSupplierInvoicesBySupplier } from "@/lib/db";
import { EditSupplierForm } from "./EditSupplierForm";
import { CreateReceptionFromPurchaseOrderButton } from "./CreateReceptionFromPurchaseOrderButton";
import { InvoiceUpload } from "./InvoiceUpload";

export default async function SupplierEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { id } = await params;
  const [supplierRes, ordersRes, notesRes, invoicesRes] = await Promise.all([
    getSupplier(id),
    getPurchaseOrders(restaurant.id, { supplierId: id, limit: 10 }),
    getDeliveryNotesBySupplier(id),
    getSupplierInvoicesBySupplier(id),
  ]);
  const { data: supplier, error } = supplierRes;
  if (error || !supplier || supplier.restaurant_id !== restaurant.id) notFound();

  const purchaseOrders = ordersRes.data ?? [];
  const displayedPoIds = purchaseOrders.slice(0, 10).map((po) => po.id);
  const deliveryNotesByPo = await getDeliveryNotesByPurchaseOrderIds(displayedPoIds);
  const deliveryNotes = notesRes.data ?? [];
  const supplierInvoices = invoicesRes.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <Link
            href="/suppliers"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Fournisseurs
          </Link>
        </div>

        <h1 className="mb-6 text-xl font-semibold text-slate-900">
          {supplier.name}
        </h1>

        <EditSupplierForm supplier={supplier} />

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">
            Commandes passées
          </h2>
        {purchaseOrders.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucune commande pour ce fournisseur.
            </p>
          ) : (
            <ul className="space-y-2">
            {purchaseOrders.slice(0, 10).map((purchaseOrder) => {
              const existingReception = purchaseOrder.id ? deliveryNotesByPo[purchaseOrder.id] : null;
              return (
                <li key={purchaseOrder.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/orders/${purchaseOrder.id}`}
                    className="text-sm text-slate-700 underline"
                  >
                    {purchaseOrder.created_at
                      ? new Date(purchaseOrder.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : ""}{" "}
                    – Commande
                  </Link>
                  {!existingReception ? (
                    <CreateReceptionFromPurchaseOrderButton
                      purchaseOrderId={
                        purchaseOrder.id && purchaseOrder.id !== "undefined"
                          ? purchaseOrder.id
                          : undefined
                      }
                    />
                  ) : (
                    <Link
                      href={`/receiving/${existingReception.id}`}
                      className="rounded border border-slate-400 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {existingReception.status === "draft"
                        ? "Ouvrir la réception"
                        : existingReception.status === "validated"
                          ? "Réception validée"
                          : "Voir la réception"}
                    </Link>
                  )}
                </li>
              );
            })}
            </ul>
          )}
          <p className="mt-2">
            <Link href="/orders" className="text-sm text-slate-600 underline">
              Voir tout l’historique des commandes
            </Link>
          </p>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">
            Réceptions
          </h2>
          {deliveryNotes.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-600">
              Aucune réception pour ce fournisseur.
            </p>
          ) : (
            <ul className="space-y-3">
              {deliveryNotes.map((dn) => {
                const displayDate = dn.delivery_date ?? dn.created_at;
                const fileUrl = dn.file_url ?? getDeliveryNoteFileUrl(dn.file_path);
                const statusLabel = dn.status === "validated" ? "Validée" : dn.status === "draft" ? "Brouillon" : dn.status === "received" ? "Reçue" : dn.status;
                const statusClass =
                  dn.status === "validated"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800";
                return (
                  <li
                    key={dn.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded border border-slate-200 bg-slate-50/50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {displayDate
                        ? new Date(displayDate).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                      {statusLabel}
                    </span>
                    {dn.purchase_order_id && (
                      <Link
                        href={`/orders/${dn.purchase_order_id}`}
                        className="text-xs text-slate-600 underline"
                      >
                        Commande liée
                      </Link>
                    )}
                    <Link
                      href={`/receiving/${dn.id}`}
                      className="text-sm font-medium text-slate-800 underline"
                    >
                      Ouvrir la réception
                    </Link>
                    {fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 underline"
                      >
                        Fichier BL
                      </a>
                    )}
                    {dn.lines_count != null && dn.lines_count > 0 && (
                      <span className="text-xs text-slate-500">
                        {dn.lines_count} ligne{dn.lines_count > 1 ? "s" : ""}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">
            Factures
          </h2>
          <div className="mb-4">
            <InvoiceUpload restaurantId={restaurant.id} supplierId={id} />
          </div>
          {supplierInvoices.length === 0 ? (
            <p className="rounded border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-600">
              Aucune facture pour ce fournisseur.
            </p>
          ) : (
            <ul className="space-y-3">
              {supplierInvoices.map((inv) => {
                const statusLabel = inv.status === "reviewed" ? "Relue" : inv.status === "linked" ? "Liée" : "Brouillon";
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded border border-slate-200 bg-slate-50/50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-900">
                      {inv.invoice_number || "Sans numéro"}
                    </span>
                    {inv.invoice_date && (
                      <span className="text-xs text-slate-600">
                        {new Date(inv.invoice_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {statusLabel}
                    </span>
                    <Link
                      href={`/supplier-invoices/${inv.id}`}
                      className="text-sm font-medium text-slate-800 underline"
                    >
                      Ouvrir la facture
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
