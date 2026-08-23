/**
 * Active / met à jour la configuration Stripe Customer Portal pour Ubion.
 *
 * Usage :
 *   npm run stripe:portal-setup
 *
 * Copiez STRIPE_BILLING_PORTAL_CONFIGURATION_ID dans .env.local (+ Vercel).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "../lib/billing/stripeApiVersion";
import { ensureUbionPortalConfiguration } from "../lib/billing/stripePortalConfiguration";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

async function main() {
  loadEnvLocal();

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY manquante dans .env.local");
    process.exit(1);
  }

  const priceId =
    process.env.STRIPE_PRICE_ID?.trim() ??
    process.env.STRIPE_PRICE_ID_BASE?.trim() ??
    null;

  const stripe = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });

  const configId = await ensureUbionPortalConfiguration(stripe, priceId);

  console.log("\n✓ Customer Portal Ubion configuré\n");
  console.log("Configuration ID :", configId);
  console.log("\nAjoutez dans .env.local et Vercel :\n");
  console.log(`STRIPE_BILLING_PORTAL_CONFIGURATION_ID=${configId}`);
  console.log("\nFonctionnalités activées :");
  console.log("  • Mise à jour e-mail client");
  console.log("  • Mise à jour carte bancaire");
  console.log("  • Historique des factures");
  console.log("  • Résiliation en fin de période");
  if (priceId) {
    console.log("  • Ajustement du nombre d'utilisateurs (quantity)");
  }
  console.log("\nDashboard : Settings → Billing → Customer portal");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
