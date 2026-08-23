-- Champs planning équipe Ubion (grille hebdo)

ALTER TABLE public.platform_staff_members
  ADD COLUMN IF NOT EXISTS color_index int,
  ADD COLUMN IF NOT EXISTS target_weekly_hours numeric,
  ADD COLUMN IF NOT EXISTS planning_carryover_minutes int NOT NULL DEFAULT 0;

ALTER TABLE public.platform_work_shifts
  ADD COLUMN IF NOT EXISTS break_minutes int;

ALTER TABLE public.platform_companies
  ADD COLUMN IF NOT EXISTS planning_security_floor int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS planning_office_hours_json jsonb;

COMMENT ON COLUMN public.platform_companies.planning_office_hours_json IS
  'Horaires bureau par jour (lun–dim) : { "mon": [{ "start": "09:00", "end": "18:00" }], ... }';
