import Link from "next/link";
import { ShieldOff, Clock, Mail, CreditCard } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getShellAccessContext } from "@/lib/auth/accessContext";
import { getRestaurantAccessStatus } from "@/lib/platform/restaurantAccess";
import { isNativeAppRequest } from "@/lib/capacitor/nativeRequest";
import {
  formatBillingOfferShort,
  isStripeConfigured,
} from "@/lib/billing/config";
import { BillingActionButton } from "@/components/billing/BillingActionButton";
import { uiBtnPrimary, uiBtnSecondary } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ reason?: string }> };

export default async function AccessBlockedPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const user = await getCurrentUser();
  const [ctx, isNativeApp] = await Promise.all([
    user ? getShellAccessContext(user.id) : Promise.resolve(null),
    isNativeAppRequest(),
  ]);
  const status = ctx?.currentRestaurantId
    ? await getRestaurantAccessStatus(ctx.currentRestaurantId)
    : null;

  const blockReason =
    reason === "suspended" ||
    reason === "trial_expired" ||
    reason === "subscription_inactive" ||
    reason === "no_entitlement"
      ? reason
      : status?.reason;
  const isSuspended = blockReason === "suspended";
  const isTrialExpired = blockReason === "trial_expired";
  const isSubscriptionInactive = blockReason === "subscription_inactive";
  const isNoEntitlement = blockReason === "no_entitlement";
  const showCheckout =
    !isNativeApp &&
    isStripeConfigured() &&
    ctx?.isOwner &&
    (isTrialExpired || isSubscriptionInactive || isNoEntitlement);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-stone-200/70 bg-white p-8 shadow-sm">
        <div
          className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${
            isSuspended ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700"
          }`}
        >
          {isTrialExpired || isSubscriptionInactive ? (
            <Clock className="h-7 w-7" aria-hidden />
          ) : isNoEntitlement ? (
            <CreditCard className="h-7 w-7" aria-hidden />
          ) : (
            <ShieldOff className="h-7 w-7" aria-hidden />
          )}
        </div>

        <h1 className="text-center text-xl font-bold text-stone-900">
          {isSuspended
            ? "Compte suspendu"
            : isTrialExpired
              ? "Période d'essai terminée"
              : isSubscriptionInactive
                ? "Abonnement inactif"
                : isNoEntitlement
                  ? "Abonnement requis"
                  : "Accès restreint"}
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-stone-600">
          {isSuspended ? (
            <>
              L&apos;accès à Ubion pour votre établissement a été suspendu.
              {status?.suspendedReason ? (
                <>
                  {" "}
                  Motif : <span className="font-medium text-stone-800">{status.suspendedReason}</span>.
                </>
              ) : null}
            </>
          ) : isTrialExpired ? (
            <>
              Votre essai Ubion est terminé
              {status?.trialExpiresAt ? (
                <>
                  {" "}
                  (expiré le{" "}
                  {new Date(status.trialExpiresAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  )
                </>
              ) : null}
              . Abonnez-vous pour continuer à utiliser Ubion Pro ({formatBillingOfferShort()}).
            </>
          ) : isSubscriptionInactive ? (
            <>
              Votre abonnement Ubion n&apos;est plus actif
              {status?.subscriptionStatus ? (
                <> (statut : {status.subscriptionStatus})</>
              ) : null}
              . Mettez à jour votre moyen de paiement ou réactivez votre abonnement.
            </>
          ) : isNoEntitlement ? (
            <>
              Un abonnement Ubion Pro ou un essai actif est requis pour utiliser l&apos;application.
              Votre établissement est conservé — réabonnez-vous pour retrouver l&apos;accès.
            </>
          ) : (
            "Votre établissement n'a pas accès à l'application pour le moment."
          )}
        </p>

        <div className="mt-8 flex flex-col gap-2">
          {isNativeApp &&
            (isTrialExpired || isSubscriptionInactive || isNoEntitlement) &&
            ctx?.isOwner && (
              <BillingActionButton mode="checkout" hideInNative />
            )}
          {showCheckout && (
            <BillingActionButton
              mode="checkout"
              label={`S'abonner — ${formatBillingOfferShort()}`}
            />
          )}
          {showCheckout && status?.subscriptionStatus === "past_due" && (
            <BillingActionButton mode="portal" label="Mettre à jour ma carte bancaire" />
          )}
          {!showCheckout && (
            <a
              href="mailto:contact@ubion.fr?subject=Accès%20Ubion"
              className={`${uiBtnPrimary} inline-flex items-center justify-center gap-2`}
            >
              <Mail className="h-4 w-4" aria-hidden />
              Contacter Ubion
            </a>
          )}
          {showCheckout && (
            <a
              href="mailto:contact@ubion.fr?subject=Abonnement%20Ubion"
              className={`${uiBtnSecondary} inline-flex items-center justify-center gap-2 text-center`}
            >
              <CreditCard className="h-4 w-4" aria-hidden />
              Besoin d&apos;aide ?
            </a>
          )}
          <Link href="/login" className={`${uiBtnSecondary} text-center`}>
            Se déconnecter
          </Link>
        </div>
      </div>
    </div>
  );
}
