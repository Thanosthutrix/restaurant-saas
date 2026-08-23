import type Stripe from "stripe";

type PortalParams = {
  priceId: string;
  productId: string;
};

/** Configuration Customer Portal Ubion (Stripe Billing). */
export function buildUbionPortalConfiguration(
  subscriptionProduct: PortalParams | null
): Stripe.BillingPortal.ConfigurationCreateParams {
  const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
    customer_update: {
      enabled: true,
      allowed_updates: ["email"],
    },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
      },
    },
  };

  if (subscriptionProduct) {
    features.subscription_update = {
      enabled: true,
      default_allowed_updates: ["quantity"],
      products: [
        {
          product: subscriptionProduct.productId,
          prices: [subscriptionProduct.priceId],
        },
      ],
    };
  }

  return {
    business_profile: {
      headline: "Ubion — gérez votre abonnement",
      privacy_policy_url: "https://www.ubion.fr/legal/privacy",
      terms_of_service_url: "https://www.ubion.fr/legal/terms",
    },
    features,
    metadata: {
      ubion_portal: "saas_pro",
    },
  };
}

export async function resolveProductIdForPrice(stripe: Stripe, priceId: string): Promise<string> {
  const price = await stripe.prices.retrieve(priceId);
  return typeof price.product === "string" ? price.product : price.product.id;
}

export async function ensureUbionPortalConfiguration(
  stripe: Stripe,
  priceId: string | null
): Promise<string> {
  const existing = await stripe.billingPortal.configurations.list({ limit: 10 });
  const match = existing.data.find((c) => c.metadata?.ubion_portal === "saas_pro" && c.active);

  let subscriptionProduct: PortalParams | null = null;
  if (priceId) {
    subscriptionProduct = {
      priceId,
      productId: await resolveProductIdForPrice(stripe, priceId),
    };
  }

  const params = buildUbionPortalConfiguration(subscriptionProduct);

  if (match) {
    const updated = await stripe.billingPortal.configurations.update(match.id, {
      business_profile: params.business_profile,
      features: params.features,
      metadata: params.metadata,
    });
    return updated.id;
  }

  const created = await stripe.billingPortal.configurations.create(params);
  return created.id;
}
