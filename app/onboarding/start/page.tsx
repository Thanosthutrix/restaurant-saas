import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, FlaskConical } from "lucide-react";
import { getAccessibleRestaurantsForUser, getCurrentUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getProspectInvitePublic } from "@/lib/admin/prospectInviteDb";
import { formatBillingOfferShort, isStripeConfigured } from "@/lib/billing/config";
import { getActiveSignupEntitlement } from "@/lib/pro/signupEntitlementDb";
import {
  getLatestTrialRequestForUser,
  getPendingTrialRequestForUser,
} from "@/lib/pro/trialRequestDb";
import { ProSignupGateActions } from "@/components/pro/ProSignupGateActions";
import { TrialApprovedWatcher } from "@/components/pro/TrialApprovedWatcher";
import { uiCard, uiLead } from "@/components/ui/premium";

type Props = { searchParams: Promise<{ invite?: string; checkout?: string }> };

export default async function OnboardingStartPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding/start");
  if (await isCurrentUserAdmin()) redirect("/admin");

  const owned = await getAccessibleRestaurantsForUser(user.id);
  if (owned.length > 0) redirect("/dashboard");

  const { invite, checkout } = await searchParams;
  const inviteToken = typeof invite === "string" && invite.length > 10 ? invite : undefined;
  if (inviteToken) redirect(`/onboarding?invite=${inviteToken}`);

  const [entitlement, pendingRequest, latestRequest] = await Promise.all([
    getActiveSignupEntitlement(user.id),
    getPendingTrialRequestForUser(user.id),
    getLatestTrialRequestForUser(user.id),
  ]);

  if (entitlement) redirect("/onboarding");

  const stripeReady = isStripeConfigured();
  const inviteInfo = null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Ubion Pro</p>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">Accédez à Ubion Pro</h1>
          <p className={`mt-2 ${uiLead}`}>
            Avant de créer votre établissement, abonnez-vous ou demandez un essai. L&apos;équipe Ubion
            valide les demandes d&apos;essai sous 24–48 h.
          </p>
        </div>

        {checkout === "success" && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Paiement reçu. Vous pouvez maintenant créer votre restaurant.
              <Link href="/onboarding" className="ml-1 font-medium underline">
                Continuer →
              </Link>
            </p>
          </div>
        )}

        {pendingRequest && (
          <>
            <TrialApprovedWatcher enabled />
            <div className={`${uiCard} border-amber-200 bg-amber-50/80`}>
              <p className="text-sm font-medium text-amber-900">Demande d&apos;essai en attente</p>
              <p className="mt-1 text-sm text-amber-800">
                Votre demande du{" "}
                {new Date(pendingRequest.created_at).toLocaleDateString("fr-FR")} est en cours de
                traitement. Vous serez notifié par e-mail.
              </p>
            </div>
          </>
        )}

        {latestRequest?.status === "rejected" && !pendingRequest && (
          <div className={`${uiCard} border-stone-200`}>
            <p className="text-sm text-stone-600">
              Votre dernière demande d&apos;essai n&apos;a pas été retenue. Vous pouvez vous abonner ou
              refaire une demande ci-dessous.
            </p>
          </div>
        )}

        <section className={`${uiCard} space-y-4`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <CreditCard className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-stone-900">S&apos;abonner</h2>
              <p className="mt-1 text-sm text-stone-600">{formatBillingOfferShort()} — accès immédiat.</p>
            </div>
          </div>
          <ProSignupGateActions mode="checkout" stripeReady={stripeReady} />
        </section>

        <section className={`${uiCard} space-y-4`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <FlaskConical className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-stone-900">Demander un essai</h2>
              <p className="mt-1 text-sm text-stone-600">
                Gratuit, sur validation de l&apos;équipe Ubion. Idéal pour découvrir la plateforme.
              </p>
            </div>
          </div>
          {!pendingRequest && (
            <ProSignupGateActions
              mode="trial-request"
              stripeReady={stripeReady}
              defaultRestaurantName={inviteInfo ?? undefined}
            />
          )}
        </section>

        <p className="text-center text-xs text-stone-400">
          <Link href="/api/auth/signout" className="hover:text-stone-600">
            Se déconnecter
          </Link>
        </p>
      </div>
    </div>
  );
}
