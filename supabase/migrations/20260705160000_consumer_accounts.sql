-- Comptes clients B2C (portail public) : profil lié à auth.users + réservations.

CREATE TABLE IF NOT EXISTS public.consumer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  phone_normalized text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_consumer_profiles_first_name CHECK (length(trim(first_name)) > 0),
  CONSTRAINT chk_consumer_profiles_last_name CHECK (length(trim(last_name)) > 0)
);

COMMENT ON TABLE public.consumer_profiles IS
  'Profil client final (portail B2C) — historique réservations, fidélité, tickets à venir.';

ALTER TABLE public.restaurant_customers
  ADD COLUMN IF NOT EXISTS consumer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rc_consumer_user
  ON public.restaurant_customers (restaurant_id, consumer_user_id)
  WHERE consumer_user_id IS NOT NULL;

ALTER TABLE public.restaurant_reservations
  ADD COLUMN IF NOT EXISTS consumer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_consumer_user
  ON public.restaurant_reservations (consumer_user_id, starts_at DESC)
  WHERE consumer_user_id IS NOT NULL;

ALTER TABLE public.restaurant_customers DROP CONSTRAINT IF EXISTS chk_rc_source;
ALTER TABLE public.restaurant_customers ADD CONSTRAINT chk_rc_source CHECK (
  source IN (
    'walk_in',
    'phone',
    'website',
    'referral',
    'social',
    'event',
    'import',
    'other',
    'app'
  )
);

CREATE OR REPLACE FUNCTION public.touch_consumer_profiles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consumer_profiles_updated ON public.consumer_profiles;
CREATE TRIGGER trg_consumer_profiles_updated
  BEFORE UPDATE ON public.consumer_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_consumer_profiles_updated_at();
