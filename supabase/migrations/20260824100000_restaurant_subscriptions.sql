-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3 admin — abonnements Stripe SaaS Ubion
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.restaurant_subscriptions (
  restaurant_id           uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  stripe_customer_id      text UNIQUE,
  stripe_subscription_id  text UNIQUE,
  status                  text NOT NULL DEFAULT 'inactive',
  price_id                text,
  mrr_cents               integer NOT NULL DEFAULT 0,
  currency                text NOT NULL DEFAULT 'eur',
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  last_payment_failed_at  timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_subscriptions_status CHECK (
    status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')
  ),
  CONSTRAINT chk_restaurant_subscriptions_mrr CHECK (mrr_cents >= 0)
);

ALTER TABLE public.restaurant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_restaurant_subscriptions_status
  ON public.restaurant_subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_restaurant_subscriptions_stripe_customer
  ON public.restaurant_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_subscriptions_payment_failed
  ON public.restaurant_subscriptions (last_payment_failed_at DESC NULLS LAST)
  WHERE last_payment_failed_at IS NOT NULL;

COMMENT ON TABLE public.restaurant_subscriptions IS
  'Abonnement SaaS Ubion par restaurant (sync Stripe).';

-- ── Idempotence webhooks Stripe ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
  ON public.stripe_webhook_events (event_type, processed_at DESC);

COMMENT ON TABLE public.stripe_webhook_events IS
  'Journal des événements Stripe traités (évite le double traitement).';
