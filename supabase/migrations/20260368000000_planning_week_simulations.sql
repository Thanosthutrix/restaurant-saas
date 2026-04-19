-- Simulations de planning par semaine (brouillon) avant publication sur work_shifts.

CREATE TABLE IF NOT EXISTS public.planning_week_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  week_monday date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_planning_week_simulation UNIQUE (restaurant_id, week_monday)
);

CREATE INDEX IF NOT EXISTS idx_planning_week_sim_restaurant
  ON public.planning_week_simulations (restaurant_id);

COMMENT ON TABLE public.planning_week_simulations IS
  'Une simulation par restaurant et par semaine (lundi de la semaine ISO locale).';

CREATE TABLE IF NOT EXISTS public.planning_simulation_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES public.planning_week_simulations(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  break_minutes int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_planning_sim_shift_times CHECK (ends_at > starts_at),
  CONSTRAINT chk_planning_sim_break CHECK (break_minutes IS NULL OR (break_minutes >= 0 AND break_minutes <= 600))
);

CREATE INDEX IF NOT EXISTS idx_planning_sim_shifts_simulation
  ON public.planning_simulation_shifts (simulation_id);

COMMENT ON TABLE public.planning_simulation_shifts IS
  'Créneaux de la simulation (pas de pointage ; publication → work_shifts).';

CREATE OR REPLACE FUNCTION public.touch_planning_week_simulations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_planning_week_simulations_updated ON public.planning_week_simulations;
CREATE TRIGGER trg_planning_week_simulations_updated
  BEFORE UPDATE ON public.planning_week_simulations
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_planning_week_simulations_updated_at();

CREATE OR REPLACE FUNCTION public.touch_planning_simulation_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_planning_simulation_shifts_updated ON public.planning_simulation_shifts;
CREATE TRIGGER trg_planning_simulation_shifts_updated
  BEFORE UPDATE ON public.planning_simulation_shifts
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_planning_simulation_shifts_updated_at();
