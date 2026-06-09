-- Plafond d’heures planifiables par jour (contrat / convention / préférence personnelle).

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS max_daily_hours numeric(4, 1);

COMMENT ON COLUMN public.staff_members.max_daily_hours IS
  'Nombre max d’heures nettes planifiables par jour civil ; NULL = pas de plafond.';

ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS chk_staff_members_max_daily_hours;
ALTER TABLE public.staff_members
  ADD CONSTRAINT chk_staff_members_max_daily_hours CHECK (
    max_daily_hours IS NULL OR (max_daily_hours >= 0 AND max_daily_hours <= 16)
  );
