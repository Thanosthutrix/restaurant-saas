/**
 * /admin/trials — liste de tous les essais (actifs + expirés).
 */

import Link from "next/link";
import { FlaskConical, ArrowLeft, Plus } from "lucide-react";
import { getAllTrials } from "@/lib/admin";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getTrialSource(source: string) {
  switch (source) {
    case "demo_by_medhi": return "Démarché par Medhi";
    case "referral":      return "Referral";
    case "organic":
    default:              return "Organique";
  }
}

export default async function AdminTrialsPage() {
  const trials = await getAllTrials();

  const now = new Date();
  const active = trials.filter((t) => new Date(t.expires_at) > now);
  const expired = trials.filter((t) => new Date(t.expires_at) <= now);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Retour
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical size={20} className="text-amber-500" />
            Accès d&apos;essai
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="text-amber-600 font-medium">{active.length} actif{active.length > 1 ? "s" : ""}</span>
            {expired.length > 0 && <span className="text-gray-400"> · {expired.length} expiré{expired.length > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <Link
          href="/admin/trials/new"
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600
                     text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} />
          Nouvel essai
        </Link>
      </div>

      {/* Essais actifs */}
      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Actifs ({active.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Restaurant</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Expire le</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody>
                {active.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/restaurants/${t.restaurant_id}`}
                        className="font-medium text-gray-800 hover:text-amber-600 transition-colors"
                      >
                        {t.restaurantName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{t.ownerEmail ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                        {getTrialSource(t.source)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700 font-medium">{formatDate(t.expires_at)}</td>
                    <td className="py-3 px-4 text-gray-400 italic text-xs">{t.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Essais expirés */}
      {expired.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Expirés ({expired.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden opacity-70">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Restaurant</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Source</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Expiré le</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Notes</th>
                </tr>
              </thead>
              <tbody>
                {expired.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/restaurants/${t.restaurant_id}`}
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {t.restaurantName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{t.ownerEmail ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-xs font-medium">
                        {getTrialSource(t.source)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{formatDate(t.expires_at)}</td>
                    <td className="py-3 px-4 text-gray-400 italic text-xs">{t.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {trials.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <FlaskConical size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun essai accordé pour l&apos;instant.</p>
        </div>
      )}
    </div>
  );
}
