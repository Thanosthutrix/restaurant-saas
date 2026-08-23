-- ═══════════════════════════════════════════════════════════════════════
-- Gate inscription Pro — essai sur demande ou paiement avant création restaurant
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS access_policy text NOT NULL DEFAULT 'legacy_free';

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS chk_restaurants_access_policy;

ALTER TABLE public.restaurants
  ADD CONSTRAINT chk_restaurants_access_policy CHECK (
    access_policy IN ('legacy_free', 'require_entitlement')
  );

COMMENT ON COLUMN public.restaurants.access_policy IS
  'legacy_free = clients historiques sans gate ; require_entitlement = essai ou abonnement obligatoire.';

-- ── Demandes d''essai (inbound, self-service) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.pro_trial_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email   text NOT NULL,
  restaurant_name text,
  message         text,
  status          text NOT NULL DEFAULT 'pending',
  trial_days      integer,
  reviewed_by     uuid REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  admin_notes     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_pro_trial_requests_email CHECK (length(trim(contact_email)) > 0),
  CONSTRAINT chk_pro_trial_requests_status CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT chk_pro_trial_requests_trial_days CHECK (
    trial_days IS NULL OR (trial_days >= 1 AND trial_days <= 90)
  )
);

ALTER TABLE public.pro_trial_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pro_trial_requests_status_created
  ON public.pro_trial_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pro_trial_requests_user
  ON public.pro_trial_requests (user_id, created_at DESC);

COMMENT ON TABLE public.pro_trial_requests IS
  'Demandes d''essai Pro avant création du restaurant (validation admin).';

-- ── Droits pré-inscription (essai approuvé ou paiement Stripe) ────────────

CREATE TABLE IF NOT EXISTS public.pro_signup_entitlements (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                   text NOT NULL,
  status                 text NOT NULL DEFAULT 'active',
  expires_at             timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text,
  trial_request_id       uuid REFERENCES public.pro_trial_requests(id) ON DELETE SET NULL,
  restaurant_id          uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  consumed_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_pro_signup_entitlements_kind CHECK (kind IN ('trial', 'subscription')),
  CONSTRAINT chk_pro_signup_entitlements_status CHECK (
    status IN ('active', 'consumed', 'expired', 'revoked')
  )
);

ALTER TABLE public.pro_signup_entitlements ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_signup_entitlements_user_active
  ON public.pro_signup_entitlements (user_id)
  WHERE status = 'active' AND consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pro_signup_entitlements_stripe_sub
  ON public.pro_signup_entitlements (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON TABLE public.pro_signup_entitlements IS
  'Droit de créer un restaurant Pro (essai admin ou abonnement payé avant onboarding).';

-- Étendre le journal support admin
ALTER TABLE public.admin_support_activities
  DROP CONSTRAINT IF EXISTS chk_admin_support_activities_action;

ALTER TABLE public.admin_support_activities
  ADD CONSTRAINT chk_admin_support_activities_action CHECK (
    action IN (
      'note', 'email_sent', 'impersonate', 'suspend', 'unsuspend',
      'trial_granted', 'reset_password', 'prospect_note', 'prospect_status',
      'prospect_created', 'invoice_viewed',
      'trial_request_approved', 'trial_request_rejected'
    )
  );
