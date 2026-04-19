-- Planning : horaires d’ouverture établissement, profil RH / contrat par collaborateur, pause planifiée sur créneau.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS planning_opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.restaurants.planning_opening_hours IS
  'Horaires d’ouverture par jour (clés mon..sun), ex. {"mon":[{"start":"11:30","end":"14:30"},{"start":"18:30","end":"23:00"}]}';

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS target_weekly_hours numeric,
  ADD COLUMN IF NOT EXISTS planning_notes text,
  ADD COLUMN IF NOT EXISTS availability_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.staff_members.contract_type IS 'CDI, CDD, extra, apprentissage, etc.';
COMMENT ON COLUMN public.staff_members.target_weekly_hours IS 'Volume horaire cible hebdo (contrat ou convention).';
COMMENT ON COLUMN public.staff_members.availability_json IS 'Horaires souhaités / habituels, même format que planning_opening_hours.';

ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS chk_staff_members_contract_type;
ALTER TABLE public.staff_members
  ADD CONSTRAINT chk_staff_members_contract_type CHECK (
    contract_type IS NULL
    OR contract_type IN ('cdi', 'cdd', 'interim', 'extra', 'apprentissage', 'stage', 'autre')
  );

ALTER TABLE public.work_shifts
  ADD COLUMN IF NOT EXISTS break_minutes int;

ALTER TABLE public.work_shifts DROP CONSTRAINT IF EXISTS chk_work_shifts_break_minutes;
ALTER TABLE public.work_shifts
  ADD CONSTRAINT chk_work_shifts_break_minutes CHECK (break_minutes IS NULL OR (break_minutes >= 0 AND break_minutes <= 600));

COMMENT ON COLUMN public.work_shifts.break_minutes IS 'Pause planifiée intégrée au créneau (repas, coupure).';
