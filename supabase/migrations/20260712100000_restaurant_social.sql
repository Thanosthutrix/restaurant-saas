-- Réseaux sociaux : liens publics + connexion Meta (stories Instagram).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_username text;

COMMENT ON COLUMN public.restaurants.instagram_url IS
  'URL publique du profil Instagram (affichée sur le portail B2C).';
COMMENT ON COLUMN public.restaurants.facebook_url IS
  'URL publique de la page Facebook (affichée sur le portail B2C).';
COMMENT ON COLUMN public.restaurants.instagram_username IS
  'Identifiant Instagram (@username) — affichage et stories.';

CREATE TABLE IF NOT EXISTS public.restaurant_meta_connections (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  meta_account_name text,
  facebook_page_id text,
  facebook_page_name text,
  facebook_page_url text,
  instagram_business_account_id text,
  instagram_username text,
  page_access_token text,
  user_access_token text,
  token_expires_at timestamptz,
  connection_status text NOT NULL DEFAULT 'disconnected',
  stories_cache jsonb NOT NULL DEFAULT '[]',
  stories_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_meta_connection_status CHECK (
    connection_status IN ('disconnected', 'connected', 'needs_action')
  )
);

COMMENT ON TABLE public.restaurant_meta_connections IS
  'Connexion Meta (Facebook Page + Instagram Business) pour stories — accès serveur uniquement.';

CREATE OR REPLACE FUNCTION public.touch_restaurant_meta_connections_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_meta_connections_updated ON public.restaurant_meta_connections;
CREATE TRIGGER trg_restaurant_meta_connections_updated
  BEFORE UPDATE ON public.restaurant_meta_connections
  FOR EACH ROW EXECUTE PROCEDURE public.touch_restaurant_meta_connections_updated_at();

ALTER TABLE public.restaurant_meta_connections ENABLE ROW LEVEL SECURITY;
