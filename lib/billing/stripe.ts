import "server-only";

import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@/lib/billing/stripeApiVersion";
import { isStripeConfigured } from "@/lib/billing/config";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe n'est pas configuré (STRIPE_SECRET_KEY).");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return stripeClient;
}

/** Client Stripe si la clé secrète existe (webhook sans price id). */
export function getStripeClientOrNull(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return stripeClient;
}

export function subscriptionMrrCents(subscription: Stripe.Subscription): number {
  let total = 0;
  for (const item of subscription.items.data) {
    const unit = item.price?.unit_amount ?? 0;
    const qty = item.quantity ?? 1;
    const interval = item.price?.recurring?.interval;
    if (interval === "month") total += unit * qty;
    else if (interval === "year") total += Math.round((unit * qty) / 12);
  }
  return total;
}
