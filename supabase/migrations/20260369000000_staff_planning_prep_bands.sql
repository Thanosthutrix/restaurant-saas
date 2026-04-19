-- Plages « prépa / hors service client » par collaborateur (préparations, réception marchandises, etc.).

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS planning_prep_bands_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.staff_members.planning_prep_bands_json IS
  'Plages horaires additionnelles (hors service client), même structure que availability_json (lun–dim).';
