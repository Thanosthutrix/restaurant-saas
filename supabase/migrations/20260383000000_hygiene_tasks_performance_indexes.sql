CREATE INDEX IF NOT EXISTS idx_hygiene_tasks_restaurant_status_due
  ON public.hygiene_tasks (restaurant_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_hygiene_tasks_restaurant_due_status
  ON public.hygiene_tasks (restaurant_id, due_at, status);
