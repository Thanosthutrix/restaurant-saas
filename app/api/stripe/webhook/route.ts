/**
 * POST /api/stripe/webhook
 * Sync abonnements Stripe → restaurant_subscriptions
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { isStripeWebhookConfigured } from "@/lib/billing/config";
import { getStripeClientOrNull } from "@/lib/billing/stripe";
import { recordStripeWebhookEvent } from "@/lib/billing/subscriptionDb";
import {
  handleStripeCheckoutCompleted,
  handleStripeInvoicePaid,
  handleStripeInvoicePaymentFailed,
  handleStripeSubscriptionEvent,
} from "@/lib/billing/stripeWebhookHandlers";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isStripeWebhookConfigured()) {
    return NextResponse.json({ error: "Webhook Stripe non configuré." }, { status: 503 });
  }

  const stripe = getStripeClientOrNull();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe indisponible." }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[stripe/webhook] signature invalid:", err);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const isNew = await recordStripeWebhookEvent({
    stripeEventId: event.id,
    eventType: event.type,
    payload: event.data.object,
  });
  if (!isNew) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleStripeCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleStripeSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleStripeInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.paid":
        await handleStripeInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] handler error:", event.type, err);
    return NextResponse.json({ error: "Traitement échoué." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
