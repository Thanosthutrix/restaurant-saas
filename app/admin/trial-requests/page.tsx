import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { listTrialRequests, type ProTrialRequestRow } from "@/lib/pro/trialRequestDb";
import { AdminTrialRequestActions } from "./AdminTrialRequestActions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: ProTrialRequestRow["status"]) {
  switch (status) {
    case "pending":
      return "En attente";
    case "approved":
      return "Approuvée";
    case "rejected":
      return "Refusée";
  }
}

export default async function AdminTrialRequestsPage() {
  const requests = await listTrialRequests();

  const pending = requests.filter((r) => r.status === "pending");
  const others = requests.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        Retour
      </Link>

      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <FlaskConical size={22} className="text-amber-500" />
        Demandes d&apos;essai Pro
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Inscriptions self-service — approuvez un essai pour débloquer la création du restaurant.
      </p>

      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          En attente ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm italic text-gray-400">Aucune demande en attente.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => (
              <article key={r.id} className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {r.restaurant_name ?? "Établissement non renseigné"}
                    </p>
                    <p className="text-sm text-gray-500">{r.contact_email}</p>
                    <p className="mt-1 text-xs text-gray-400">Reçue le {formatDate(r.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    {statusLabel(r.status)}
                  </span>
                </div>
                {r.message && (
                  <p className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{r.message}</p>
                )}
                <AdminTrialRequestActions requestId={r.id} />
              </article>
            ))}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Historique</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-2">Établissement</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Statut</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {others.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {r.restaurant_name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{r.contact_email}</td>
                    <td className="px-4 py-2.5">{statusLabel(r.status)}</td>
                    <td className="px-4 py-2.5 text-gray-400">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
