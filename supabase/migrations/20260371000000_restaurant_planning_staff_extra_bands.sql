-- Plages où l’effectif peut être planifié hors service au public (prépa, réception, nettoyage, etc.).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS planning_staff_extra_bands_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.restaurants.planning_staff_extra_bands_json IS
  'Modèle hebdo : plages travail sans service client (même structure JSON que planning_opening_hours).';
