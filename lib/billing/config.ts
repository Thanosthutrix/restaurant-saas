/** Configuration billing SaaS Ubion (Stripe). */

export const BILLING_BASE_PRICE_EUR = 150;
export const BILLING_SEAT_PRICE_EUR = 8.33;
export const BILLING_INCLUDED_SEATS = 5;
export const BILLING_MAX_SEATS = 12;
export const PAST_DUE_GRACE_DAYS = 7;

/** @deprecated Utiliser BILLING_BASE_PRICE_EUR */
export const BILLING_MONTHLY_PRICE_EUR = BILLING_BASE_PRICE_EUR;

/** Price Stripe unique (paliers gradués : forfait 5 users + suppl. par user). */
export function getStripePriceId(): string | null {
  return (
    process.env.STRIPE_PRICE_ID ??
    process.env.STRIPE_PRICE_ID_BASE ??
    process.env.STRIPE_PRICE_ID_MONTHLY ??
    null
  );
}

/** @deprecated Utiliser getStripePriceId */
export function getStripePriceIdBase(): string | null {
  return getStripePriceId();
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && getStripePriceId());
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/** @deprecated Utiliser getStripePriceId */
export function getStripePriceIdMonthly(): string | null {
  return getStripePriceId();
}

export function getAppBillingBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

export function getBillingCheckoutSuccessUrl(): string {
  return `${getAppBillingBaseUrl()}/settings/billing?checkout=success`;
}

export function getBillingCheckoutCancelUrl(): string {
  return `${getAppBillingBaseUrl()}/access-blocked?reason=trial_expired`;
}

export function getPreSignupCheckoutSuccessUrl(): string {
  return `${getAppBillingBaseUrl()}/onboarding/start?checkout=success`;
}

export function getPreSignupCheckoutCancelUrl(): string {
  return `${getAppBillingBaseUrl()}/onboarding/start?checkout=cancel`;
}

export function getBillingPortalReturnUrl(): string {
  const fromEnv = process.env.STRIPE_BILLING_PORTAL_RETURN_URL;
  if (fromEnv) return fromEnv;
  return `${getAppBillingBaseUrl()}/settings/billing`;
}

export function getStripePortalConfigurationId(): string | null {
  return process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim() ?? null;
}

/** Nombre d'utilisateurs facturables envoyé à Stripe (quantity sur le price à paliers). */
export function clampBillableUsers(totalUsers: number): number {
  return Math.min(Math.max(totalUsers, 1), BILLING_MAX_SEATS);
}

export function formatBillingOfferShort(): string {
  return `${BILLING_BASE_PRICE_EUR} € HT/mois · ${BILLING_INCLUDED_SEATS} utilisateurs inclus`;
}

export function formatBillingOfferDetail(): string {
  return `${BILLING_BASE_PRICE_EUR} € HT/mois pour ${BILLING_INCLUDED_SEATS} utilisateurs, puis ${BILLING_SEAT_PRICE_EUR} € HT/mois par utilisateur supplémentaire (max. ${BILLING_MAX_SEATS}).`;
}

/** Statuts Stripe considérés comme abonnement actif (accès app). */
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active", "past_due"]);

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_SUBSCRIPTION_STATUSES.has(status));
}

export function isPastDueGraceExpired(lastPaymentFailedAt: string | null): boolean {
  if (!lastPaymentFailedAt) return false;
  const cutoff = Date.now() - PAST_DUE_GRACE_DAYS * 86400000;
  return new Date(lastPaymentFailedAt).getTime() < cutoff;
}
