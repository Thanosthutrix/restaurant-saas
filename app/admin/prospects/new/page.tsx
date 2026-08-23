import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewProspectForm } from "./NewProspectForm";

export default function AdminNewProspectPage() {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link
        href="/admin/prospects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
      >
        <ArrowLeft size={15} />
        Retour aux prospects
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Nouveau prospect</h1>
      <p className="mt-1 mb-8 text-sm text-gray-500">
        Créez une fiche CRM et générez un lien d&apos;invitation pré-inscription.
      </p>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <NewProspectForm />
      </div>
    </div>
  );
}
