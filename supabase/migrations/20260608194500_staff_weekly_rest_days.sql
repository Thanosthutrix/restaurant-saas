-- Nombre de jours de repos souhaités par semaine, par collaborateur.
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS planning_weekly_rest_days integer NOT NULL DEFAULT 2;

ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_planning_weekly_rest_days_check;

ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_planning_weekly_rest_days_check
  CHECK (planning_weekly_rest_days >= 0 AND planning_weekly_rest_days <= 7);

COMMENT ON COLUMN public.staff_members.planning_weekly_rest_days IS
  'Nombre de jours de repos souhaités par semaine pour la génération planning (0 à 7).';
