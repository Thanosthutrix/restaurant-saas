import { getAdminInvoicesList } from "@/lib/admin/invoicesDb";
import { AdminInvoicesEmptyState, AdminInvoicesTable } from "./AdminInvoicesTable";

export default async function AdminInvoicesPage() {
  const invoices = await getAdminInvoicesList();

  const draftCount = invoices.filter((i) => i.status === "draft").length;
  const linkedCount = invoices.filter((i) => i.status === "linked").length;

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Factures fournisseurs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vue cross-client — rapprochement et contrôle des écarts.
          {invoices.length > 0 && (
            <>
              {" "}
              · {draftCount} à traiter · {linkedCount} à contrôler
            </>
          )}
        </p>
      </div>

      {invoices.length === 0 ? <AdminInvoicesEmptyState /> : <AdminInvoicesTable invoices={invoices} />}
    </div>
  );
}
