/**
 * Tableau de bord admin — vue d'ensemble de la plateforme Ubion.
 */

import { Users, TrendingUp, FlaskConical, Wallet, ArrowUpRight, Clock, AlertTriangle, UserPlus, Globe } from "lucide-react";
import { getAdminStatsWithInactive, getLatestSignups, getInactiveRestaurants, getProspectsToFollowUp } from "@/lib/admin";
import { getSiteAnalyticsSummary } from "@/lib/admin/siteAnalytics";
import { getBillingStats } from "@/lib/billing/subscriptionDb";
import { getAdminProspectStatusLabel } from "@/lib/admin/types";
import { isStripeConfigured } from "@/lib/billing/config";
import { countPendingTrialRequests, listPendingTrialRequests } from "@/lib/pro/trialRequestDb";
import { AdminPendingTrialAlert } from "@/components/admin/AdminPendingTrialAlert";

function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} sem`;
  return formatDate(iso);
}

function isTrialActive(expiresAt: string) {
  return new Date(expiresAt) > new Date();
}

export default async function AdminDashboardPage() {
  const [stats, latestSignups, inactiveRestaurants, prospectsToFollowUp, billing, pendingTrialCount, pendingTrials, siteAnalytics] =
    await Promise.all([
    getAdminStatsWithInactive(),
    getLatestSignups(8),
    getInactiveRestaurants(7),
    getProspectsToFollowUp(5),
    getBillingStats(),
    countPendingTrialRequests(),
    listPendingTrialRequests(5),
    getSiteAnalyticsSummary(),
  ]);

  const stripeReady = isStripeConfigured();
  const mrrLabel = stripeReady ? formatEur(billing.mrrCents / 100) : "—";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-1">
          Vue d&apos;ensemble de la plateforme Ubion —{" "}
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <AdminPendingTrialAlert count={pendingTrialCount} requests={pendingTrials} variant="card" />

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          label="Clients total"
          value={stats.totalRestaurants}
          icon={<Users size={18} />}
          color="blue"
        />
        <KpiCard
          label="Prospects actifs"
          value={stats.activeProspects}
          icon={<UserPlus size={18} />}
          color="blue"
          hint="En cours de suivi"
        />
        <KpiCard
          label="Nouveaux ce mois"
          value={stats.newThisMonth}
          icon={<TrendingUp size={18} />}
          color="green"
          hint="vs. mois dernier"
        />
        <KpiCard
          label="Essais demandés"
          value={pendingTrialCount}
          icon={<FlaskConical size={18} />}
          color={pendingTrialCount > 0 ? "amber" : "blue"}
          hint={pendingTrialCount > 0 ? "En attente de validation" : "Aucune demande en cours"}
          href={pendingTrialCount > 0 ? "/admin/trial-requests" : undefined}
          highlight={pendingTrialCount > 0}
        />
        <KpiCard
          label="Essais actifs"
          value={stats.activeTrials}
          icon={<FlaskConical size={18} />}
          color="amber"
        />
        <KpiCard
          label="Inactifs 7j+"
          value={stats.inactiveCount}
          icon={<AlertTriangle size={18} />}
          color="amber"
          hint="Pas connecté depuis 7 jours"
        />
        <KpiCard
          label="MRR"
          value={mrrLabel}
          icon={<Wallet size={18} />}
          color="purple"
          hint={stripeReady ? `${billing.activeCount + billing.pastDueCount} abonnements` : "Configurer Stripe"}
        />
      </div>

      {/* Trafic site public */}
      <section className="mb-8 rounded-xl border border-violet-100 bg-violet-50/40 p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-violet-950">
          <Globe size={16} className="text-violet-600" />
          Visiteurs site public (ubion.fr)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <VisitStat label="Aujourd'hui" value={siteAnalytics.uniqueToday} sub={`${siteAnalytics.pageViewsToday} pages vues`} />
          <VisitStat label="7 jours" value={siteAnalytics.unique7d} sub={`${siteAnalytics.pageViews7d} pages vues`} />
          <VisitStat label="30 jours" value={siteAnalytics.unique30d} sub="visiteurs uniques" />
        </div>
        {siteAnalytics.topPaths7d.length > 0 ? (
          <div className="mt-4 border-t border-violet-100 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-violet-800/80">
              Pages les plus vues (7 j)
            </p>
            <ul className="space-y-1.5">
              {siteAnalytics.topPaths7d.map((row) => (
                <li key={row.path} className="flex items-center justify-between gap-3 text-sm">
                  <code className="truncate text-violet-900">{row.path}</code>
                  <span className="shrink-0 font-semibold text-violet-800">{row.views}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-violet-800/70">
            Les statistiques apparaîtront dès les premières visites sur l&apos;annuaire, les fiches restaurant et
            ubion.fr/pro.
          </p>
        )}
      </section>

      {prospectsToFollowUp.length > 0 && (
        <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50/60 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-blue-900">
              <UserPlus size={16} />
              Prospects à relancer
            </h2>
            <a href="/admin/prospects" className="text-xs font-medium text-blue-700 hover:underline">
              Voir tous
            </a>
          </div>
          <ul className="space-y-2">
            {prospectsToFollowUp.map((p) => {
              const status = getAdminProspectStatusLabel(p.status);
              return (
                <li key={p.id}>
                  <a
                    href={`/admin/prospects/${p.id}`}
                    className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm transition hover:bg-white"
                  >
                    <span className="font-medium text-gray-900">
                      {p.contact_name ?? p.contact_email}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {inactiveRestaurants.length > 0 && (
        <div className="mb-8 rounded-xl border border-orange-100 bg-orange-50/60 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-orange-900">
              <AlertTriangle size={16} />
              Clients inactifs — relance recommandée
            </h2>
            <a href="/admin/restaurants" className="text-xs font-medium text-orange-700 hover:underline">
              Voir tous
            </a>
          </div>
          <ul className="space-y-2">
            {inactiveRestaurants.slice(0, 5).map((r) => (
              <li key={r.id}>
                <a
                  href={`/admin/restaurants/${r.id}`}
                  className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm transition hover:bg-white"
                >
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="text-xs text-orange-700">
                    {r.owner_last_sign_in
                      ? `Dernière connexion : ${formatDate(r.owner_last_sign_in)}`
                      : "Jamais connecté"}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Derniers inscrits */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Derniers inscrits</h2>
          <a
            href="/admin/restaurants"
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
          >
            Voir tous <ArrowUpRight size={13} />
          </a>
        </div>

        <div className="divide-y divide-gray-50">
          {latestSignups.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-gray-400">
              Aucun client encore.
            </p>
          )}
          {latestSignups.map((r) => (
            <a
              key={r.id}
              href={`/admin/restaurants/${r.id}`}
              className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <span className="text-amber-700 font-bold text-sm">
                  {r.name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {r.owner_email ?? "Email inconnu"}
                </p>
              </div>

              {/* Statuts */}
              <div className="flex items-center gap-2 shrink-0">
                {r.suspended_at && (
                  <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                    Suspendu
                  </span>
                )}
                {r.trial && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      isTrialActive(r.trial.expires_at)
                        ? "bg-amber-50 text-amber-700"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isTrialActive(r.trial.expires_at) ? "Essai" : "Essai expiré"}
                  </span>
                )}

                {/* Date */}
                <div className="flex items-center gap-1 text-xs text-gray-400 w-24 justify-end">
                  <Clock size={11} />
                  {formatRelative(r.created_at)}
                </div>

                <ArrowUpRight
                  size={14}
                  className="text-gray-300 group-hover:text-amber-500 transition-colors"
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Composant KPI ──────────────────────────────────────────────────────────

type KpiColor = "blue" | "green" | "amber" | "purple";

const colorMap: Record<KpiColor, { bg: string; icon: string; value: string }> = {
  blue:   { bg: "bg-blue-50",   icon: "text-blue-500",   value: "text-blue-900" },
  green:  { bg: "bg-green-50",  icon: "text-green-500",  value: "text-green-900" },
  amber:  { bg: "bg-amber-50",  icon: "text-amber-500",  value: "text-amber-900" },
  purple: { bg: "bg-purple-50", icon: "text-purple-500", value: "text-purple-900" },
};

function KpiCard({
  label,
  value,
  icon,
  color,
  hint,
  href,
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: KpiColor;
  hint?: string;
  href?: string;
  highlight?: boolean;
}) {
  const c = colorMap[color];
  const content = (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 transition-colors ${
        highlight ? "border-amber-400 ring-2 ring-amber-200" : "border-gray-100"
      }`}
    >
      <div className={`inline-flex p-2 rounded-lg ${c.bg} ${c.icon} mb-3`}>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {hint && <p className={`text-xs mt-1 ${highlight ? "font-medium text-amber-600" : "text-gray-400"}`}>{hint}</p>}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block hover:opacity-95">
        {content}
      </a>
    );
  }

  return content;
}

function VisitStat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-white/80 px-3 py-3">
      <p className="text-2xl font-bold text-violet-950">{value.toLocaleString("fr-FR")}</p>
      <p className="text-sm font-medium text-violet-900">{label}</p>
      <p className="mt-0.5 text-xs text-violet-700/80">{sub}</p>
    </div>
  );
}
