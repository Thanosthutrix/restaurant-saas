-- Migrations en attente — à exécuter dans Supabase SQL Editor si npm run db:apply échoue.
-- Dashboard : https://supabase.com/dashboard/project/abkpugghvlcuvyojbrof/sql/new

-- Plages de pointe hebdomadaires (modèle établissement)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS planning_peak_bands_weekly jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.restaurants.planning_peak_bands_weekly IS
  'Plages de pointe par jour type, ex. {"fri":[{"start":"12:00","end":"14:00","staffCount":5}]}. Préremplit le questionnaire d''ébauche de planning.';

-- Notifie PostgREST de recharger le schéma (optionnel, se fait aussi automatiquement)
NOTIFY pgrst, 'reload schema';
