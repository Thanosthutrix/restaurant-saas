-- Solde d’heures (report semaine à semaine) pour le planning manuel : écart cumulé vs contrat.

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS planning_carryover_minutes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.staff_members.planning_carryover_minutes IS
  'Minutes cumulées reportées (contrat − prévu net) ; positif = heures encore à couvrir, négatif = surplus.';
