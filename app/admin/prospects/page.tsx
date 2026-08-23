import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { getAllProspects } from "@/lib/admin";
import { AdminProspectsTable } from "./AdminProspectsTable";

export default async function AdminProspectsPage() {
  const prospects = await getAllProspects();

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="mt-1 text-sm text-gray-500">
            CRM onboarding — contacts avant inscription restaurant.
          </p>
        </div>
        <Link
          href="/admin/prospects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600"
        >
          <Plus size={16} />
          Nouveau prospect
        </Link>
      </div>

      {prospects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <UserPlus className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-sm text-gray-500">Aucun prospect pour l&apos;instant.</p>
          <Link
            href="/admin/prospects/new"
            className="mt-4 inline-block text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            Ajouter votre premier prospect →
          </Link>
        </div>
      ) : (
        <AdminProspectsTable prospects={prospects} />
      )}
    </div>
  );
}
