import type Stripe from "stripe";

/** Requis pour Checkout / Managed Payments (Stripe ≥ mars 2025). */
export const STRIPE_API_VERSION = "2025-03-31.basil" as Stripe.LatestApiVersion;
