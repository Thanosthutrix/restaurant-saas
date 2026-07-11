-- Intégration Google Business Profile (Phase A : liaison + OAuth)

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_maps_uri text,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2, 1),
  ADD COLUMN IF NOT EXISTS google_review_count integer,
  ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;

COMMENT ON COLUMN public.restaurants.google_place_id IS
  'Place ID Google Maps (Places API) lié au restaurant.';

CREATE TABLE IF NOT EXISTS public.restaurant_google_connections (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  google_account_email text,
  google_account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  google_account_name text,
  google_location_name text,
  verification_status text NOT NULL DEFAULT 'none',
  connection_status text NOT NULL DEFAULT 'disconnected',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_google_verification_status CHECK (
    verification_status IN ('none', 'pending', 'verified', 'failed')
  ),
  CONSTRAINT chk_restaurant_google_connection_status CHECK (
    connection_status IN ('disconnected', 'connected', 'needs_action')
  )
);

COMMENT ON TABLE public.restaurant_google_connections IS
  'Jetons OAuth Google Business Profile par restaurant (accès serveur uniquement).';
