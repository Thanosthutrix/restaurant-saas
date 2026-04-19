-- Objectifs d’effectif par jour de semaine + exceptions (fériés, vacances, horaires spéciaux).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS planning_staff_targets_weekly jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.restaurants.planning_staff_targets_weekly IS
  'Nombre de personnes cibles par jour type, ex. {"mon":4,"fri":5}. Les jours absents = non renseigné.';

CREATE TABLE IF NOT EXISTS public.restaurant_planning_day_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  day date NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  /** null = reprendre les plages du jour type ; sinon remplace (plages vides si fermé). */
  opening_bands_override jsonb,
  /** null = reprendre l’objectif du jour type dans planning_staff_targets_weekly. */
  staff_target_override int,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_planning_override_restaurant_day UNIQUE (restaurant_id, day),
  CONSTRAINT chk_planning_override_staff_target CHECK (
    staff_target_override IS NULL OR (staff_target_override >= 0 AND staff_target_override <= 500)
  )
);

CREATE INDEX IF NOT EXISTS idx_planning_overrides_restaurant_day
  ON public.restaurant_planning_day_overrides (restaurant_id, day);

COMMENT ON TABLE public.restaurant_planning_day_overrides IS
  'Exception ponctuelle : fermeture, horaires spéciaux, effectif cible différent (férié, vacances scolaires…).';

CREATE OR REPLACE FUNCTION public.touch_restaurant_planning_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_planning_overrides_updated ON public.restaurant_planning_day_overrides;
CREATE TRIGGER trg_planning_overrides_updated
  BEFORE UPDATE ON public.restaurant_planning_day_overrides
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_restaurant_planning_overrides_updated_at();
