-- ═══════════════════════════════════════════════════════════════════════
-- Espace admin Ubion — tables & colonnes nécessaires
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Superadmins de la plateforme ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.platform_admins IS
  'Superadmins de la plateforme Ubion (accès espace admin complet).';

-- ── 2. Accès d''essai accordés aux restaurants ────────────────────────────
CREATE TABLE IF NOT EXISTS public.trial_accesses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  granted_by    uuid REFERENCES auth.users(id),
  -- source : 'organic' (inscription spontanée), 'demo_by_medhi' (démarché), 'referral'
  source        text NOT NULL DEFAULT 'organic',
  expires_at    timestamptz NOT NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trial_accesses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_trial_accesses_restaurant
  ON public.trial_accesses (restaurant_id, expires_at DESC);
COMMENT ON TABLE public.trial_accesses IS
  'Périodes d''essai accordées avant paiement. Source = comment le client est arrivé.';

-- ── 3. Notes internes admin par restaurant ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES auth.users(id),
  content       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_admin_notes_content CHECK (length(trim(content)) > 0)
);
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_admin_notes_restaurant
  ON public.admin_notes (restaurant_id, created_at DESC);
COMMENT ON TABLE public.admin_notes IS
  'Notes internes de Medhi sur les clients (appels, relances, problèmes…).';

-- ── 4. Suspension de compte ───────────────────────────────────────────────
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS suspended_at     timestamptz;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS suspended_reason text;
COMMENT ON COLUMN public.restaurants.suspended_at IS
  'NULL = compte actif. Non-null = suspendu par un admin (ex. impayé).';

-- ═══════════════════════════════════════════════════════════════════════
-- Après avoir exécuté ce script, ajouter Medhi comme superadmin :
--
--   INSERT INTO public.platform_admins (user_id)
--   SELECT id FROM auth.users WHERE email = 'medhi.thuleau@gmail.com';
--
-- ═══════════════════════════════════════════════════════════════════════
