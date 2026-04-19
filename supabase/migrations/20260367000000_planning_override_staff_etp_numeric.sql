-- Objectif d’effectif en ETP (équivalent temps plein) : décimales autorisées.

ALTER TABLE public.restaurant_planning_day_overrides
  DROP CONSTRAINT IF EXISTS chk_planning_override_staff_target;

ALTER TABLE public.restaurant_planning_day_overrides
  ALTER COLUMN staff_target_override TYPE numeric(6, 2)
  USING CASE
    WHEN staff_target_override IS NULL THEN NULL
    ELSE staff_target_override::numeric
  END;

ALTER TABLE public.restaurant_planning_day_overrides
  ADD CONSTRAINT chk_planning_override_staff_target
  CHECK (staff_target_override IS NULL OR (staff_target_override >= 0 AND staff_target_override <= 500));

COMMENT ON COLUMN public.restaurant_planning_day_overrides.staff_target_override IS
  'ETP cible pour ce jour si différent du modèle hebdomadaire (planning_staff_targets_weekly).';
