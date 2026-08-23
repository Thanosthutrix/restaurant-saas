/**
 * Provisionne le produit Stripe « Ubion Pro » (49 €/mois) et affiche les variables à copier.
 *
 * Usage :
 *   STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup
 *
 * Prérequis Dashboard Stripe :
 *   Settings → Billing → Customer portal → activer le portail client
 */
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "../lib/billing/stripeApiVersion";

const PRODUCT_NAME = "Ubion Pro";
const PRODUCT_METADATA_KEY = "ubion_product";
const PRODUCT_METADATA_VALUE = "saas_pro";
const MONTHLY_AMOUNT_CENTS = 4900;
const CURRENCY = "eur";

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY manquante.");
    console.error("Exemple : STRIPE_SECRET_KEY=sk_test_... npm run stripe:setup");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });

  let product: Stripe.Product | null = null;
  const existing = await stripe.products.search({
    query: `metadata['${PRODUCT_METADATA_KEY}']:'${PRODUCT_METADATA_VALUE}'`,
    limit: 1,
  });
  if (existing.data[0]) {
    product = existing.data[0];
    console.log(`Produit existant : ${product.id} (${product.name})`);
  } else {
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description: "Abonnement SaaS Ubion — facturation, réservations, salle, stocks, équipe.",
      metadata: { [PRODUCT_METADATA_KEY]: PRODUCT_METADATA_VALUE },
    });
    console.log(`Produit créé : ${product.id}`);
  }

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: "recurring",
    limit: 20,
  });

  let price =
    prices.data.find(
      (p) =>
        p.recurring?.interval === "month" &&
        p.unit_amount === MONTHLY_AMOUNT_CENTS &&
        p.currency === CURRENCY
    ) ?? null;

  if (price) {
    console.log(`Tarif existant : ${price.id} (${MONTHLY_AMOUNT_CENTS / 100} €/mois)`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: MONTHLY_AMOUNT_CENTS,
      currency: CURRENCY,
      recurring: { interval: "month" },
      metadata: { [PRODUCT_METADATA_KEY]: PRODUCT_METADATA_VALUE },
    });
    console.log(`Tarif créé : ${price.id}`);
  }

  const account = await stripe.accounts.retrieve();
  const mode = secretKey.startsWith("sk_live_") ? "live" : "test";

  console.log("\n── Copiez dans .env.local ──────────────────────────────────────\n");
  console.log(`STRIPE_SECRET_KEY=${secretKey}`);
  console.log(`STRIPE_PRICE_ID_MONTHLY=${price.id}`);
  console.log("# Récupérez la clé publishable dans Dashboard → Developers → API keys");
  console.log("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...");
  console.log("# Webhook local : stripe listen --forward-to localhost:3000/api/stripe/webhook");
  console.log("# Webhook prod  : https://www.ubion.fr/api/stripe/webhook");
  console.log("STRIPE_WEBHOOK_SECRET=whsec_...");

  console.log("\n── Événements webhook à activer ────────────────────────────────\n");
  for (const t of [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "invoice.paid",
  ]) {
    console.log(`  • ${t}`);
  }

  console.log("\n── Compte Stripe ───────────────────────────────────────────────\n");
  console.log(`  Mode     : ${mode}`);
  console.log(`  Account  : ${account.id}`);
  console.log(`  Dashboard: https://dashboard.stripe.com/${mode === "test" ? "test/" : ""}products/${product.id}`);
  console.log("\nN'oubliez pas d'activer le Customer Portal (Settings → Billing → Customer portal).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
