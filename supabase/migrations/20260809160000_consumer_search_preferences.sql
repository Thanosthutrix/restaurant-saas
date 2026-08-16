-- Phase 2 B2C : préférences client persistantes + embeddings recherche.

CREATE TABLE IF NOT EXISTS public.consumer_search_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  excluded_establishment_types text[] NOT NULL DEFAULT '{}',
  default_intent text,
  preferred_noise_level text,
  min_price_tier text,
  max_price_tier text,
  preferred_occasions text[] NOT NULL DEFAULT '{}',

  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_csp_noise CHECK (
    preferred_noise_level IS NULL OR preferred_noise_level IN ('quiet', 'moderate', 'lively')
  ),
  CONSTRAINT chk_csp_min_price CHECK (
    min_price_tier IS NULL OR min_price_tier IN ('euro_1', 'euro_2', 'euro_3', 'euro_4')
  ),
  CONSTRAINT chk_csp_max_price CHECK (
    max_price_tier IS NULL OR max_price_tier IN ('euro_1', 'euro_2', 'euro_3', 'euro_4')
  )
);

COMMENT ON TABLE public.consumer_search_preferences IS
  'Préférences recherche B2C : exclusions et affinités persistées par compte client.';

ALTER TABLE public.restaurant_experience_profiles
  ADD COLUMN IF NOT EXISTS search_embedding jsonb;

COMMENT ON COLUMN public.restaurant_experience_profiles.search_embedding IS
  'Vecteur embedding (OpenAI) pour affiner la recherche sémantique — JSON array of floats.';

CREATE OR REPLACE FUNCTION public.touch_consumer_search_preferences_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_csp_updated ON public.consumer_search_preferences;
CREATE TRIGGER trg_csp_updated
  BEFORE UPDATE ON public.consumer_search_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.touch_consumer_search_preferences_updated_at();
