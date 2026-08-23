/**
 * /admin/finances — revenus réels (Stripe) + alertes paiement.
 */

import { ArrowLeft, TrendingUp, Users, FlaskConical, CreditCard, AlertTriangle, Zap } from "lucide-react";
import Link from "next/link";
import { getAdminStats, getAllRestaurantsWithOwners } from "@/lib/admin";
import {
  getBillingStats,
  getRecentPaymentFailures,
  getSubscriptionsWithRestaurants,
} from "@/lib/billing/subscriptionDb";
import { BILLING_BASE_PRICE_EUR, formatBillingOfferDetail, isStripeConfigured } from "@/lib/billing/config";

function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function subscriptionStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Actif";
    case "past_due":
      return "En retard";
    case "trialing":
      return "Essai Stripe";
    case "canceled":
      return "Annulé";
    case "unpaid":
      return "Impayé";
    default:
      return status;
  }
}

export default async function AdminFinancesPage() {
  const [stats, restaurants, billing, failures, subscriptions] = await Promise.all([
    getAdminStats(),
    getAllRestaurantsWithOwners(),
    getBillingStats(),
    getRecentPaymentFailures(8),
    getSubscriptionsWithRestaurants(),
  ]);

  const now = new Date();
  const suspended = restaurants.filter((r) => r.suspended_at).length;
  const activeTrials = restaurants.filter(
    (r) => r.trial && new Date(r.trial.expires_at) > now && !r.suspended_at
  ).length;

  const mrr = billing.mrrCents / 100;
  const arr = billing.arrCents / 100;
  const stripeReady = isStripeConfigured();

  const trialsBySource: Record<string, number> = {};
  for (const r of restaurants) {
    if (r.trial && new Date(r.trial.expires_at) > now) {
      const src = r.trial.source ?? "organic";
      trialsBySource[src] = (trialsBySource[src] ?? 0) + 1;
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        Retour
      </Link>

      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <TrendingUp size={20} className="text-purple-500" />
          Finances
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          {stripeReady ? (
            <>
              MRR/ARR synchronisés depuis Stripe · {formatBillingOfferDetail()}
            </>
          ) : (
            <>
              Stripe non configuré — configurez les variables d&apos;environnement pour activer les
              paiements.
            </>
          )}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<TrendingUp size={16} className="text-purple-500" />}
          label="MRR"
          value={stripeReady ? formatEur(mrr) : "—"}
          sub={`${billing.activeCount + billing.pastDueCount} abonnement${billing.activeCount + billing.pastDueCount > 1 ? "s" : ""} facturé${billing.activeCount + billing.pastDueCount > 1 ? "s" : ""}`}
          color="purple"
        />
        <KpiCard
          icon={<Zap size={16} className="text-amber-500" />}
          label="ARR"
          value={stripeReady ? formatEur(arr) : "—"}
          sub="sur 12 mois"
          color="amber"
        />
        <KpiCard
          icon={<CreditCard size={16} className="text-green-500" />}
          label="Abonnements actifs"
          value={String(billing.activeCount)}
          sub={`${billing.pastDueCount} en retard · ${billing.trialingCount} essai Stripe`}
          color="green"
        />
        <KpiCard
          icon={<FlaskConical size={16} className="text-blue-500" />}
          label="Essais plateforme"
          value={String(activeTrials)}
          sub={`${suspended} suspendu${suspended > 1 ? "s" : ""} · ${stats.totalRestaurants} clients`}
          color="blue"
        />
      </div>

      {failures.length > 0 && (
        <section className="mb-8 rounded-xl border border-red-100 bg-red-50/60 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-red-900">
            <AlertTriangle size={16} />
            Échecs de paiement récents
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-100 text-left text-xs uppercase tracking-wide text-red-700">
                  <th className="pb-2 pr-4">Restaurant</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Statut</th>
                  <th className="pb-2">Échec le</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.restaurantId} className="border-b border-red-50">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/admin/restaurants/${f.restaurantId}`}
                        className="font-medium text-gray-900 hover:text-amber-600"
                      >
                        {f.restaurantName}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">{f.ownerEmail ?? "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {subscriptionStatusLabel(f.status)}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500">{formatDate(f.failedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 font-semibold text-gray-900">Abonnements Stripe</h2>
          {subscriptions.length === 0 ? (
            <p className="text-sm italic text-gray-400">Aucun abonnement enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-4">Restaurant</th>
                    <th className="pb-2 pr-4">Statut</th>
                    <th className="pb-2 pr-4">MRR</th>
                    <th className="pb-2">Renouvellement</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((s) => (
                    <tr key={s.restaurant_id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/admin/restaurants/${s.restaurant_id}`}
                          className="font-medium text-gray-900 hover:text-amber-600"
                        >
                          {s.restaurantName}
                        </Link>
                        <p className="text-xs text-gray-400">{s.ownerEmail ?? ""}</p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.status === "active"
                              ? "bg-green-50 text-green-700"
                              : s.status === "past_due"
                                ? "bg-red-50 text-red-600"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {subscriptionStatusLabel(s.status)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-gray-800">
                        {formatEur(s.mrr_cents / 100)}
                      </td>
                      <td className="py-2.5 text-gray-500">
                        {s.current_period_end ? formatDate(s.current_period_end) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Source des essais actifs</h2>
          {Object.keys(trialsBySource).length === 0 ? (
            <p className="text-sm italic text-gray-400">Aucun essai actif.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(trialsBySource).map(([src, count]) => (
                <div key={src} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {src === "demo_by_medhi"
                      ? "Démarché par Medhi"
                      : src === "referral"
                        ? "Referral"
                        : "Organique"}
                  </span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
            <Users size={16} />
            Vue d&apos;ensemble
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Clients total</dt>
              <dd className="font-semibold text-gray-900">{stats.totalRestaurants}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Nouveaux ce mois</dt>
              <dd className="font-semibold text-gray-900">{stats.newThisMonth}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Abonnements annulés</dt>
              <dd className="font-semibold text-gray-900">{billing.canceledCount}</dd>
            </div>
          </dl>
        </section>
      </div>

      {!stripeReady && (
        <div className="mt-8 flex items-center gap-4 rounded-xl border border-purple-100 bg-purple-50 p-5">
          <CreditCard size={20} className="shrink-0 text-purple-400" />
          <div>
            <p className="text-sm font-semibold text-purple-800">Configurer Stripe</p>
            <p className="mt-0.5 text-xs text-purple-600">
              Ajoutez STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET et
              NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY dans .env.local. Webhook : /api/stripe/webhook
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: "purple" | "amber" | "blue" | "green";
}) {
  const bg: Record<string, string> = {
    purple: "bg-purple-50",
    amber: "bg-amber-50",
    blue: "bg-blue-50",
    green: "bg-green-50",
  };
  return (
    <div className={`${bg[color]} rounded-xl p-4`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
    </div>
  );
}
