import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { isNativeAppRequest } from "@/lib/capacitor/nativeRequest";
import { getSubscriptionByRestaurantId } from "@/lib/billing/subscriptionDb";
import {
  formatBillingOfferDetail,
  formatBillingOfferShort,
  isActiveSubscriptionStatus,
  isStripeConfigured,
} from "@/lib/billing/config";
import { BillingActionButton } from "@/components/billing/BillingActionButton";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { uiCard, uiLead } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ checkout?: string }> };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "active":
      return "Actif";
    case "trialing":
      return "Essai Stripe";
    case "past_due":
      return "Paiement en retard";
    case "canceled":
      return "Annulé";
    case "unpaid":
      return "Impayé";
    case "inactive":
      return "Non abonné";
    default:
      return status ?? "—";
  }
}

export default async function BillingSettingsPage({ searchParams }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { checkout } = await searchParams;
  const [subscription, isNativeApp] = await Promise.all([
    getSubscriptionByRestaurantId(restaurant.id),
    isNativeAppRequest(),
  ]);
  const stripeReady = isStripeConfigured();
  const hasActiveSub = isActiveSubscriptionStatus(subscription?.status ?? null);

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Réglages", href: "/settings" },
          { label: "Abonnement" },
        ]}
        title="Abonnement Ubion Pro"
      />

      {checkout === "success" && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Paiement reçu — votre abonnement sera activé dans quelques instants. Rechargez la page si
            le statut n&apos;est pas encore à jour.
          </p>
        </div>
      )}

      <section className={`${uiCard} space-y-4`}>
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Statut</h2>
          <p className={`mt-1 ${uiLead}`}>
            {statusLabel(subscription?.status ?? null)}
            {subscription?.current_period_end && hasActiveSub ? (
              <>
                {" "}
                — prochain renouvellement le {formatDate(subscription.current_period_end)}
              </>
            ) : null}
            {subscription?.cancel_at_period_end ? (
              <span className="block text-amber-700">Annulation prévue en fin de période.</span>
            ) : null}
          </p>
        </div>

        <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-700">
          <p className="font-medium">Ubion Pro — {formatBillingOfferShort()}</p>
          <p className="mt-1 text-stone-500">{formatBillingOfferDetail()}</p>
        </div>

        {!stripeReady && (
          <p className="text-sm text-amber-700">
            Le paiement en ligne n&apos;est pas encore activé sur cette instance. Contactez Ubion
            pour activer votre abonnement.
          </p>
        )}

        {stripeReady && !hasActiveSub && (
          <BillingActionButton
            mode="checkout"
            label={`S'abonner — ${formatBillingOfferShort()}`}
            hideInNative={isNativeApp}
          />
        )}

        {stripeReady && subscription?.stripe_customer_id && (
          <div className="space-y-2">
            <BillingActionButton mode="portal" hideInNative={isNativeApp} />
            <p className="text-center text-xs text-stone-500">
              Carte bancaire, factures et résiliation — portail sécurisé Stripe.
            </p>
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-stone-400">
        <Link href="/settings" className="hover:text-stone-600">
          ← Retour aux réglages
        </Link>
      </p>
    </PageContainer>
  );
}
