import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ExternalLink,
  FlaskConical,
  Mail,
  Phone,
  StickyNote,
} from "lucide-react";
import { getProspectAdminDetail } from "@/lib/admin";
import {
  getAdminProspectSourceLabel,
  getAdminProspectStatusLabel,
  isProspectInviteActive,
} from "@/lib/admin/types";
import { AdminProspectActions } from "./AdminProspectActions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { prospect, notes, inviteUrl } = await getProspectAdminDetail(id);

  if (!prospect) notFound();

  const status = getAdminProspectStatusLabel(prospect.status);
  const inviteActive = isProspectInviteActive(prospect);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link
        href="/admin/prospects"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
      >
        <ArrowLeft size={14} />
        Retour aux prospects
      </Link>

      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <Mail className="text-blue-600" size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {prospect.contact_name ?? prospect.contact_email}
            </h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
              {status.label}
            </span>
            {inviteActive && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Invitation active
              </span>
            )}
          </div>
          {prospect.restaurant_name && (
            <p className="mt-1 text-sm text-gray-500">{prospect.restaurant_name}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Coordonnées</h2>
            <dl className="space-y-3 text-sm">
              <InfoRow icon={<Mail size={14} />} label="Email" value={prospect.contact_email} />
              {prospect.phone && (
                <InfoRow icon={<Phone size={14} />} label="Téléphone" value={prospect.phone} />
              )}
              {prospect.restaurant_name && (
                <InfoRow
                  icon={<Building2 size={14} />}
                  label="Restaurant prévu"
                  value={prospect.restaurant_name}
                />
              )}
              <InfoRow
                icon={<Calendar size={14} />}
                label="Créé le"
                value={formatDate(prospect.created_at)}
              />
              <InfoRow
                label="Source"
                value={getAdminProspectSourceLabel(prospect.source)}
              />
              {prospect.trial_days && (
                <InfoRow
                  icon={<FlaskConical size={14} />}
                  label="Essai auto"
                  value={`${prospect.trial_days} jours à l'inscription`}
                />
              )}
            </dl>
          </div>

          {prospect.notes && (
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Notes initiales</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-600">{prospect.notes}</p>
            </div>
          )}

          {prospect.restaurant_id && (
            <div className="rounded-xl border border-green-100 bg-green-50/50 p-5">
              <p className="text-sm font-medium text-green-800">Prospect converti en client</p>
              <Link
                href={`/admin/restaurants/${prospect.restaurant_id}`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:underline"
              >
                Voir la fiche client <ExternalLink size={13} />
              </Link>
            </div>
          )}

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <StickyNote size={15} />
              Historique des notes
            </h2>
            {notes.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune note pour l&apos;instant.</p>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-gray-50 px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm text-gray-700">{n.content}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDate(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <AdminProspectActions
            prospectId={prospect.id}
            inviteUrl={inviteUrl}
            currentStatus={prospect.status}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="mt-0.5 text-gray-400">{icon}</span>}
      <div>
        <dt className="text-xs text-gray-400">{label}</dt>
        <dd className="font-medium text-gray-800">{value}</dd>
      </div>
    </div>
  );
}
