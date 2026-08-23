import Link from "next/link";
import { Headphones } from "lucide-react";
import { getAdminSupportActivitiesEnriched } from "@/lib/admin/supportActivityDb";
import { getAdminSupportActionLabel, type AdminSupportAction } from "@/lib/admin/supportTypes";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = { searchParams: Promise<{ action?: string }> };

export default async function AdminSupportPage({ searchParams }: Props) {
  const { action } = await searchParams;
  const actionFilter =
    action && typeof action === "string" ? (action as AdminSupportAction) : undefined;

  const activities = await getAdminSupportActivitiesEnriched(80);
  const filtered = actionFilter
    ? activities.filter((a) => a.action === actionFilter)
    : activities;

  const actionCounts = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.action] = (acc[a.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Headphones size={22} className="text-amber-600" />
          Journal support
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Timeline unifiée — notes, emails, suspensions, essais, impersonations…
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterLink href="/admin/support" label="Tout" active={!actionFilter} count={activities.length} />
        {(["email_sent", "note", "suspend", "trial_granted", "impersonate"] as AdminSupportAction[]).map(
          (act) => (
            <FilterLink
              key={act}
              href={`/admin/support?action=${act}`}
              label={getAdminSupportActionLabel(act).label}
              active={actionFilter === act}
              count={actionCounts[act] ?? 0}
            />
          )
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
            Aucune activité enregistrée. Appliquez la migration Phase 4 si la table n&apos;existe pas
            encore.
          </p>
        )}
        {filtered.map((a) => {
          const badge = getAdminSupportActionLabel(a.action);
          return (
            <article
              key={a.id}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                  {badge.label}
                </span>
                <time className="text-xs text-gray-400">{formatDate(a.created_at)}</time>
                {a.authorEmail && (
                  <span className="text-xs text-gray-400">· {a.authorEmail}</span>
                )}
              </div>
              <p className="text-sm text-gray-800">{a.summary}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {a.restaurantName && a.restaurant_id && (
                  <Link
                    href={`/admin/restaurants/${a.restaurant_id}`}
                    className="font-medium text-amber-600 hover:underline"
                  >
                    {a.restaurantName}
                  </Link>
                )}
                {a.prospectContact && a.prospect_id && (
                  <Link
                    href={`/admin/prospects/${a.prospect_id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {a.prospectContact}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
  count,
}: {
  href: string;
  label: string;
  active: boolean;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-amber-500 bg-amber-50 text-amber-700"
          : "border-gray-200 text-gray-600 hover:border-amber-300"
      }`}
    >
      {label} {count > 0 && <span className="text-gray-400">({count})</span>}
    </Link>
  );
}
