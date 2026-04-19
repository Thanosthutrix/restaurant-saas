-- Modèles de plages horaires réutilisables (fériés, vacances, pics d’activité).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS planning_band_presets jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.restaurants.planning_band_presets IS
  'Liste de modèles { id, label, bands: [{start,end}] } pour exceptions calendrier (vacances d’été, etc.).';
