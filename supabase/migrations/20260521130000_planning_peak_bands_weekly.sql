-- Modèle hebdomadaire : plages de pointe (rush) + effectif minimum par plage.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS planning_peak_bands_weekly jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.restaurants.planning_peak_bands_weekly IS
  'Plages de pointe par jour type, ex. {"fri":[{"start":"12:00","end":"14:00","staffCount":5},{"start":"19:00","end":"22:30","staffCount":6}]}. Préremplit le questionnaire d''ébauche de planning.';
