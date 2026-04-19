-- Origine des lignes d’exception : saisie manuelle vs calendrier guidé (fériés / vacances).

ALTER TABLE public.restaurant_planning_day_overrides
  ADD COLUMN IF NOT EXISTS calendar_source text;

ALTER TABLE public.restaurant_planning_day_overrides
  DROP CONSTRAINT IF EXISTS chk_planning_override_calendar_source;

ALTER TABLE public.restaurant_planning_day_overrides
  ADD CONSTRAINT chk_planning_override_calendar_source
  CHECK (calendar_source IS NULL OR calendar_source IN ('public_holiday', 'school_vacation'));

COMMENT ON COLUMN public.restaurant_planning_day_overrides.calendar_source IS
  'public_holiday ou school_vacation si la ligne vient du calendrier guidé ; NULL = saisie manuelle.';
