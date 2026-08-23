import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSignature } from "lucide-react";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function AdminCompanyContractsPage() {
  const company = await getPlatformCompany();
  if (!company) redirect("/admin/company");

  const { data: contracts } = await supabaseServer
    .from("platform_contracts")
    .select("id, contract_kind, employee_first_name, employee_last_name, title, status, created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl pb-4">
      <Link href="/admin/company" className="text-xs text-gray-500 hover:text-gray-700">
        ← Ma société
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
        <FileSignature size={22} className="text-amber-600" />
        Contrats
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Gestion RH interne Ubion — réutilise le moteur de contrats (hors convention HCR restaurant).
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
        Création de contrats via l&apos;assistant — prochaine étape. Le moteur HCR restaurant sera
        adapté pour SYNTEC / contrats génériques.
      </div>

      {(contracts ?? []).length > 0 ? (
        <ul className="mt-6 space-y-2">
          {(contracts ?? []).map((c) => (
            <li
              key={(c as { id: string }).id}
              className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm shadow-sm"
            >
              <span className="font-medium text-gray-900">
                {(c as { employee_first_name: string }).employee_first_name}{" "}
                {(c as { employee_last_name: string }).employee_last_name}
              </span>
              <span className="text-gray-500">
                {" "}
                · {(c as { contract_kind: string }).contract_kind.toUpperCase()} ·{" "}
                {(c as { status: string }).status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
