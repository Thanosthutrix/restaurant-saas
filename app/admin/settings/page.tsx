/**
 * /admin/settings — configuration plateforme (phase 1).
 */

import Link from "next/link";
import { ArrowLeft, Bell, Euro, Shield, Webhook } from "lucide-react";
import { getAdminPlatformSettings } from "@/lib/admin";

export default async function AdminSettingsPage() {
  const settings = await getAdminPlatformSettings();

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-800"
      >
        <ArrowLeft size={15} />
        Retour au tableau de bord
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Paramètres plateforme</h1>
      <p className="mt-1 text-sm text-gray-500">Configuration de l&apos;espace admin Ubion.</p>

      <div className="mt-8 space-y-4">
        <SettingsCard
          icon={<Shield size={18} />}
          title="Accès administrateur"
          rows={[
            { label: "Email admin", value: settings.adminEmail },
            { label: "Superadmins (table platform_admins)", value: String(settings.platformAdminsCount) },
          ]}
        />

        <SettingsCard
          icon={<Euro size={18} />}
          title="Tarification & Stripe"
          rows={[
            { label: "Prix de base", value: `${settings.monthlyPriceEur} € HT / mois` },
            {
              label: "Grille",
              value: settings.billingOfferDetail,
            },
            {
              label: "Stripe",
              value: settings.stripeConfigured ? "Configuré" : "Non configuré — voir .env.local",
            },
            { label: "Webhook Stripe", value: settings.stripeWebhookUrl, mono: true },
            { label: "Price (paliers)", value: "STRIPE_PRICE_ID" },
          ]}
        />

        <SettingsCard
          icon={<Bell size={18} />}
          title="Notifications nouvelles inscriptions"
          rows={[
            {
              label: "Webhook Supabase (restaurants)",
              value: settings.webhookNewRestaurantUrl,
              mono: true,
            },
            {
              label: "Webhook Supabase (prospects)",
              value: settings.webhookNewProspectUrl,
              mono: true,
            },
            { label: "Variable", value: "WEBHOOK_SECRET (optionnelle)" },
            { label: "Email destinataire", value: settings.adminEmail },
            { label: "Push admin", value: "Tokens des superadmins (app native)" },
          ]}
        />

        <SettingsCard
          icon={<Webhook size={18} />}
          title="Enforcement accès client"
          rows={[
            { label: "Suspension", value: "Bloque l'app pro immédiatement" },
            { label: "Essai expiré", value: "Bloque si un essai existe et est expiré" },
            { label: "Sans essai enregistré", value: "Accès autorisé (clients historiques)" },
          ]}
        />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-gray-400">
        Feature flags par client et plans tarifaires multiples seront disponibles en phase ultérieure.
      </p>
    </div>
  );
}

function SettingsCard({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: { label: string; value: string; mono?: boolean }[];
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-gray-900">
        <span className="text-amber-600">{icon}</span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-sm text-gray-500">{row.label}</dt>
            <dd className={`text-sm font-medium text-gray-900 sm:text-right ${row.mono ? "font-mono text-xs break-all" : ""}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
