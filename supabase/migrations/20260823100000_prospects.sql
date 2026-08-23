-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2 admin — prospects CRM & invitations pré-inscription
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prospects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name        text,
  contact_email       text NOT NULL,
  restaurant_name     text,
  phone               text,
  source              text NOT NULL DEFAULT 'outbound',
  status              text NOT NULL DEFAULT 'new',
  notes               text,
  invite_token        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invite_expires_at   timestamptz,
  invite_consumed_at  timestamptz,
  trial_days          integer,
  restaurant_id       uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_prospects_email CHECK (length(trim(contact_email)) > 0),
  CONSTRAINT chk_prospects_status CHECK (
    status IN ('new', 'contacted', 'demo_scheduled', 'invited', 'signed_up', 'lost')
  ),
  CONSTRAINT chk_prospects_trial_days CHECK (trial_days IS NULL OR (trial_days >= 1 AND trial_days <= 90))
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_prospects_status_created
  ON public.prospects (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prospects_email
  ON public.prospects (lower(contact_email));

CREATE INDEX IF NOT EXISTS idx_prospects_invite_token
  ON public.prospects (invite_token)
  WHERE invite_consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_restaurant
  ON public.prospects (restaurant_id)
  WHERE restaurant_id IS NOT NULL;

COMMENT ON TABLE public.prospects IS
  'Prospects CRM Ubion — contacts avant inscription restaurant.';

-- ── Notes internes par prospect ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prospect_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES auth.users(id),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_prospect_notes_content CHECK (length(trim(content)) > 0)
);

ALTER TABLE public.prospect_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_prospect_notes_prospect
  ON public.prospect_notes (prospect_id, created_at DESC);

COMMENT ON TABLE public.prospect_notes IS
  'Notes internes admin sur les prospects (appels, relances, démos…).';
