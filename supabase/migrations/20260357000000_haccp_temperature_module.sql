-- Module relevés de températures HACCP (points, tâches planifiées, registre avec statuts).

CREATE TABLE IF NOT EXISTS public.temperature_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  point_type text NOT NULL,
  location text NOT NULL DEFAULT '',
  min_threshold numeric(5, 2) NOT NULL,
  max_threshold numeric(5, 2) NOT NULL,
  recurrence_type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_temperature_point_type CHECK (
    point_type IN ('cold_storage', 'freezer', 'hot_holding', 'cooling', 'receiving')
  ),
  CONSTRAINT chk_temperature_point_recurrence CHECK (recurrence_type IN ('daily', 'per_service')),
  CONSTRAINT chk_temperature_point_min_max CHECK (min_threshold < max_threshold)
);

CREATE INDEX IF NOT EXISTS idx_temperature_points_restaurant ON public.temperature_points (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_temperature_points_active ON public.temperature_points (restaurant_id, active);

CREATE TABLE IF NOT EXISTS public.temperature_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  temperature_point_id uuid NOT NULL REFERENCES public.temperature_points(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_temperature_task_status CHECK (status IN ('pending', 'completed')),
  CONSTRAINT uq_temperature_task_point_period UNIQUE (temperature_point_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_temperature_tasks_restaurant_due ON public.temperature_tasks (restaurant_id, due_at);
CREATE INDEX IF NOT EXISTS idx_temperature_tasks_pending ON public.temperature_tasks (restaurant_id, status, due_at);

CREATE TABLE IF NOT EXISTS public.temperature_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  temperature_point_id uuid NOT NULL REFERENCES public.temperature_points(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.temperature_tasks(id) ON DELETE SET NULL,
  value numeric(5, 2) NOT NULL,
  log_status text NOT NULL,
  recorded_by_user_id uuid,
  recorded_by_display text,
  comment text,
  corrective_action text,
  product_impact text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_temperature_log_status CHECK (log_status IN ('normal', 'alert', 'critical'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_temperature_logs_task_id ON public.temperature_logs (task_id)
  WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_temperature_logs_restaurant_time ON public.temperature_logs (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_temperature_logs_status ON public.temperature_logs (restaurant_id, log_status);

COMMENT ON TABLE public.temperature_points IS 'Points de mesure HACCP configurés par restaurant.';
COMMENT ON TABLE public.temperature_tasks IS 'Occurrences de relevé à effectuer (génération idempotente par period_key).';
COMMENT ON COLUMN public.temperature_logs.log_status IS 'normal | alert (proche seuil) | critical (hors plage).';

CREATE OR REPLACE FUNCTION public.touch_temperature_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_temperature_points_updated ON public.temperature_points;
CREATE TRIGGER trg_temperature_points_updated
  BEFORE UPDATE ON public.temperature_points
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_temperature_points_updated_at();
