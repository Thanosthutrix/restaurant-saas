import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, FileText, FileOutput, FileSignature } from "lucide-react";
import { getPlatformCompany, listPlatformSuppliers } from "@/lib/platform/companyDb";
import { CompanyProfileForm } from "./CompanyProfileForm";
import { CompanySuppliersSection } from "./CompanySuppliersSection";

export default async function AdminCompanyPage() {
  const company = await getPlatformCompany();
  const suppliers = company ? await listPlatformSuppliers(company.id) : [];

  return (
    <div className="mx-auto max-w-3xl pb-4">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Building2 size={22} className="text-amber-600" />
          Ma société
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Compta interne Ubion — sans lien avec les restaurants clients.
        </p>
      </div>

      <CompanyProfileForm company={company} />

      {company ? (
        <>
          <div className="my-6">
            <CompanySuppliersSection suppliers={suppliers} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HubLink
              href="/admin/company/invoices"
              icon={FileText}
              title="Factures reçues"
              desc="Import, PA, contrôle, export comptable"
            />
            <HubLink
              href="/admin/company/emitted"
              icon={FileOutput}
              title="Factures émises"
              desc="Clients Ubion — émission et suivi (bientôt PA)"
            />
            <HubLink
              href="/admin/company/contracts"
              icon={FileSignature}
              title="Contrats"
              desc="RH interne — CDI, CDD, freelances"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function HubLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-amber-200"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
        <Icon size={18} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-xs text-gray-500">{desc}</span>
      </span>
    </Link>
  );
}
