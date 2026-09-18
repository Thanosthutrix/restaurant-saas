-- Visites du site public (annuaire, fiches restaurant, pro…) — agrégées dans l'admin.

CREATE TABLE IF NOT EXISTS public.platform_site_visits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key  text NOT NULL,
  path         text NOT NULL,
  visited_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_site_visits_path CHECK (length(trim(path)) > 0),
  CONSTRAINT chk_platform_site_visits_session CHECK (length(trim(session_key)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_site_visits_visited_at
  ON public.platform_site_visits (visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_site_visits_session_visited
  ON public.platform_site_visits (session_key, visited_at DESC);

ALTER TABLE public.platform_site_visits ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.platform_site_visits IS
  'Pages vues site public Ubion — visiteurs uniques via session_key (cookie anonyme).';
