import Link from "next/link";
import { redirect } from "next/navigation";
import { FileOutput } from "lucide-react";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import { listPlatformCustomers, listPlatformEmittedInvoices } from "@/lib/platform/emittedInvoicesDb";
import { getPlatformPaConnection } from "@/lib/platform/platformPaDb";
import { EmittedCustomersSection } from "./EmittedCustomersSection";
import { EmittedInvoicesPanel } from "./EmittedInvoicesPanel";
import { PlatformEmittedPaCard } from "./PlatformEmittedPaCard";

export default async function AdminCompanyEmittedPage() {
  const company = await getPlatformCompany();
  if (!company) redirect("/admin/company");

  const [customers, invoices, paConnection] = await Promise.all([
    listPlatformCustomers(company.id),
    listPlatformEmittedInvoices(company.id),
    getPlatformPaConnection(company.id),
  ]);

  const paConnected = paConnection?.enrollment_status === "active";
  const draftCount = invoices.filter((i) => i.status === "draft").length;
  const sentCount = invoices.filter((i) => i.status === "sent").length;

  return (
    <div className="mx-auto max-w-4xl pb-4">
      <Link href="/admin/company" className="text-xs text-gray-500 hover:text-gray-700">
        ← Ma société
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
        <FileOutput size={22} className="text-amber-600" />
        Factures émises
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {company.legal_name} — facturation B2B et émission via Portail Agréé.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Brouillons</p>
          <p className="text-2xl font-bold text-amber-700">{draftCount}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Émises PA</p>
          <p className="text-2xl font-bold text-emerald-700">{sentCount}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:col-span-1">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <PlatformEmittedPaCard
          connection={
            paConnection
              ? {
                  enrollmentStatus: paConnection.enrollment_status,
                  companyVerificationStatus: paConnection.company_verification_status,
                  lastInvoiceEmittedAt: paConnection.last_invoice_emitted_at,
                  lastError: paConnection.last_error,
                }
              : null
          }
        />

        {!company.siret ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Complétez le SIRET de votre société dans{" "}
            <Link href="/admin/company" className="font-medium underline">
              le profil société
            </Link>{" "}
            avant d&apos;émettre des factures PA.
          </div>
        ) : null}

        <EmittedCustomersSection customers={customers} />
        <EmittedInvoicesPanel customers={customers} invoices={invoices} paConnected={paConnected} />
      </div>
    </div>
  );
}
