-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4 admin — journal activité support
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_support_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid REFERENCES auth.users(id),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  prospect_id   uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  action        text NOT NULL,
  summary       text NOT NULL,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_admin_support_activities_summary CHECK (length(trim(summary)) > 0),
  CONSTRAINT chk_admin_support_activities_action CHECK (
    action IN (
      'note', 'email_sent', 'impersonate', 'suspend', 'unsuspend',
      'trial_granted', 'reset_password', 'prospect_note', 'prospect_status',
      'prospect_created', 'invoice_viewed'
    )
  )
);

ALTER TABLE public.admin_support_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_support_activities_created
  ON public.admin_support_activities (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_support_activities_restaurant
  ON public.admin_support_activities (restaurant_id, created_at DESC)
  WHERE restaurant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_support_activities_action
  ON public.admin_support_activities (action, created_at DESC);

COMMENT ON TABLE public.admin_support_activities IS
  'Journal unifié des actions support admin (notes, emails, suspensions, essais…).';
