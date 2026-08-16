-- Profil expérience B2C : déclaratif restaurateur + enrichissement IA périodique.

CREATE TABLE IF NOT EXISTS public.restaurant_experience_profiles (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,

  -- Étape 1 : hard tagging (plafond de catégorie — non contournable par l'IA)
  establishment_type text NOT NULL,
  price_tier text NOT NULL,

  -- Étape 2 : ambiance & cadre
  noise_level text,
  occasions text[] NOT NULL DEFAULT '{}',
  venue_features text[] NOT NULL DEFAULT '{}',

  -- Étape 3 : expression libre
  experience_summary text,
  signature_dish text,

  -- Synthèse IA (avis + carte, rafraîchie par cron hebdomadaire)
  ai_search_summary text,
  ai_search_keywords text[] NOT NULL DEFAULT '{}',
  ai_last_refreshed_at timestamptz,
  factual_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  completed_at timestamptz,
  declarative_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_rep_price_tier CHECK (price_tier IN ('euro_1', 'euro_2', 'euro_3', 'euro_4')),
  CONSTRAINT chk_rep_noise_level CHECK (
    noise_level IS NULL OR noise_level IN ('quiet', 'moderate', 'lively')
  ),
  CONSTRAINT chk_rep_experience_summary_len CHECK (
    experience_summary IS NULL OR length(trim(experience_summary)) <= 2000
  ),
  CONSTRAINT chk_rep_signature_dish_len CHECK (
    signature_dish IS NULL OR length(trim(signature_dish)) <= 500
  )
);

CREATE INDEX IF NOT EXISTS idx_rep_establishment_type
  ON public.restaurant_experience_profiles (establishment_type);
CREATE INDEX IF NOT EXISTS idx_rep_price_tier
  ON public.restaurant_experience_profiles (price_tier);

COMMENT ON TABLE public.restaurant_experience_profiles IS
  'Fiche d''identité expérience B2C : hard tags restaurateur + enrichissement IA hebdomadaire.';
COMMENT ON COLUMN public.restaurant_experience_profiles.establishment_type IS
  'Type strict (fast_food, gastronomic, pizzeria…) — plafond de catégorie pour le matching.';
COMMENT ON COLUMN public.restaurant_experience_profiles.price_tier IS
  'euro_1 (<20€) … euro_4 (>75€) — ticket moyen déclaré.';

-- Rate limiting recherche IA B2C (par clé client : IP hash ou session)
CREATE TABLE IF NOT EXISTS public.b2c_ai_search_usage (
  client_key text PRIMARY KEY,
  search_count int NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.b2c_ai_search_usage IS
  'Compteur recherches IA B2C par session/IP (fenêtre glissante).';

CREATE OR REPLACE FUNCTION public.touch_restaurant_experience_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rep_updated ON public.restaurant_experience_profiles;
CREATE TRIGGER trg_rep_updated
  BEFORE UPDATE ON public.restaurant_experience_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.touch_restaurant_experience_profiles_updated_at();
