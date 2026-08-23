/**
 * Fiche détaillée d'un client — espace admin.
 * Affiche les infos du restaurant, l'historique des essais, les notes internes,
 * et les actions disponibles (suspension, essai, note).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Calendar,
  FlaskConical,
  StickyNote,
  ExternalLink,
  Clock,
  Activity,
  LogIn,
  FileText,
  Truck,
  Users,
  BarChart3,
} from "lucide-react";
import { getRestaurantAdminDetail } from "@/lib/admin";
import { AdminActionButtons } from "./AdminActionButtons";
import { AdminSendEmailPanel } from "./AdminSendEmailPanel";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isTrialActive(expiresAt: string) {
  return new Date(expiresAt) > new Date();
}

function getTrialSource(source: string) {
  switch (source) {
    case "demo_by_medhi": return "Démarché par Medhi";
    case "referral":     return "Referral";
    case "organic":
    default:             return "Organique";
  }
}

export default async function AdminRestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { restaurant, trials, notes, usage } = await getRestaurantAdminDetail(id);

  if (!restaurant) notFound();

  const isSuspended = !!restaurant.suspended_at;
  const activeTrial = trials.find((t) => isTrialActive(t.expires_at));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Retour */}
      <Link
        href="/admin/restaurants"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={14} />
        Retour aux clients
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <span className="text-amber-700 font-bold text-xl">
            {restaurant.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
            {isSuspended && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
                Suspendu
              </span>
            )}
            {activeTrial && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
                Essai actif
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
            <Mail size={13} className="text-gray-400" />
            {restaurant.owner_email ?? "Email inconnu"}
            {restaurant.owner_name && (
              <span className="text-gray-400">— {restaurant.owner_name}</span>
            )}
          </p>
          <p className="text-gray-400 text-xs mt-1 flex items-center gap-1.5">
            <Calendar size={12} />
            Inscrit le {formatDate(restaurant.created_at)}
          </p>
          {restaurant.owner_last_sign_in && (
            <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1.5">
              <LogIn size={12} />
              Dernière connexion : {formatDate(restaurant.owner_last_sign_in)}
            </p>
          )}
        </div>

        {/* Lien vers l'app du restaurateur */}
        <a
          href={`/dashboard`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 border border-gray-200
                     rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ExternalLink size={13} />
          Voir app
        </a>
      </div>

      {/* ── Boutons d'action ─────────────────────────────────── */}
      <AdminActionButtons
        restaurantId={restaurant.id}
        ownerId={restaurant.owner_id}
        ownerEmail={restaurant.owner_email}
        isSuspended={isSuspended}
        suspendedReason={restaurant.suspended_reason}
        hasActiveTrial={!!activeTrial}
      />

      <section className="mt-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <AdminSendEmailPanel
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          ownerEmail={restaurant.owner_email}
          ownerName={restaurant.owner_name}
        />
      </section>

      {/* ── Métriques d'usage ──────────────────────────────────── */}
      <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity size={15} className="text-gray-400" />
          Utilisation
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard
            icon={<FileText size={14} className="text-blue-500" />}
            label="Factures fournisseur"
            value={usage.supplierInvoicesCount}
            color="blue"
          />
          <MetricCard
            icon={<Truck size={14} className="text-purple-500" />}
            label="Bons de livraison"
            value={usage.deliveryNotesCount}
            color="purple"
          />
          <MetricCard
            icon={<BarChart3 size={14} className="text-amber-500" />}
            label="Fournisseurs"
            value={usage.suppliersCount}
            color="amber"
          />
          <MetricCard
            icon={<FileText size={14} className="text-green-500" />}
            label="Imports tickets"
            value={usage.ticketImportsCount}
            color="green"
          />
          <MetricCard
            icon={<Users size={14} className="text-rose-500" />}
            label="Staff actif"
            value={usage.staffMembersCount}
            color="rose"
          />
          <MetricCard
            icon={<Calendar size={14} className="text-teal-500" />}
            label="Réservations"
            value={usage.reservationsCount}
            color="teal"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* ── Infos restaurant ─────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={15} className="text-gray-400" />
            Informations
          </h2>
          <dl className="space-y-3">
            <InfoRow label="Nom" value={restaurant.name} />
            <InfoRow label="Type d'activité" value={restaurant.activity_type ?? "—"} />
            <InfoRow label="ID restaurant" value={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{restaurant.id}</code>} />
            <InfoRow label="ID propriétaire" value={<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{restaurant.owner_id}</code>} />
            {isSuspended && (
              <>
                <InfoRow
                  label="Suspendu le"
                  value={formatDate(restaurant.suspended_at!)}
                  valueClass="text-red-600"
                />
                {restaurant.suspended_reason && (
                  <InfoRow
                    label="Raison"
                    value={restaurant.suspended_reason}
                    valueClass="text-red-500"
                  />
                )}
              </>
            )}
          </dl>
        </section>

        {/* ── Historique essais ─────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FlaskConical size={15} className="text-gray-400" />
            Accès d&apos;essai ({trials.length})
          </h2>
          {trials.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun essai accordé.</p>
          ) : (
            <div className="space-y-3">
              {trials.map((t) => {
                const active = isTrialActive(t.expires_at);
                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-lg border ${
                      active
                        ? "border-amber-200 bg-amber-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-semibold ${
                          active ? "text-amber-700" : "text-gray-400"
                        }`}
                      >
                        {active ? "✓ Actif" : "Expiré"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {getTrialSource(t.source)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Expire le{" "}
                      <strong>{formatDateShort(t.expires_at)}</strong>
                    </p>
                    {t.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">{t.notes}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-1">
                      Créé le {formatDateShort(t.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Notes internes ─────────────────────────────────────── */}
      <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <StickyNote size={15} className="text-gray-400" />
          Notes internes ({notes.length})
        </h2>

        {/* Formulaire d'ajout de note */}
        <AdminNoteForm restaurantId={restaurant.id} />

        {/* Liste des notes */}
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400 italic mt-4">
            Aucune note pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-3 mt-4">
            {notes.map((n) => (
              <div key={n.id} className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                <p className="text-sm text-gray-700">{n.content}</p>
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <Clock size={11} />
                  {formatDate(n.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  valueClass = "text-gray-700",
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="text-xs text-gray-400 w-32 shrink-0 pt-0.5">{label}</dt>
      <dd className={`text-sm flex-1 min-w-0 ${valueClass}`}>{value}</dd>
    </div>
  );
}

// ── MetricCard ─────────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "purple" | "amber" | "green" | "rose" | "teal";
}) {
  const bgMap: Record<string, string> = {
    blue: "bg-blue-50",
    purple: "bg-purple-50",
    amber: "bg-amber-50",
    green: "bg-green-50",
    rose: "bg-rose-50",
    teal: "bg-teal-50",
  };
  return (
    <div className={`${bgMap[color]} rounded-lg p-3 flex items-center gap-3`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{label}</p>
      </div>
    </div>
  );
}

// Formulaire de note — Client Component importé
function AdminNoteForm({ restaurantId }: { restaurantId: string }) {
  // Rendu serveur du formulaire (action = API route)
  return (
    <form
      action="/api/admin/note"
      method="POST"
      className="flex gap-2"
    >
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <input
        type="text"
        name="content"
        placeholder="Ajouter une note interne (appel, relance, problème…)"
        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2
                   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
        required
      />
      <button
        type="submit"
        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm
                   font-medium rounded-lg transition-colors"
      >
        Ajouter
      </button>
    </form>
  );
}
