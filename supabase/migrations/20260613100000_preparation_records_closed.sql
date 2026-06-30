-- Clôture manuelle d'une préparation (stock épuisé, DLC dépassée, ou autre raison).
-- Une préparation reste visible sur la page tant que closed_at IS NULL.

ALTER TABLE public.preparation_records
  ADD COLUMN IF NOT EXISTS closed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS closed_reason text;

-- Index pour lister rapidement les préparations actives (non clôturées) par restaurant.
CREATE INDEX IF NOT EXISTS preparation_records_active_idx
  ON public.preparation_records (restaurant_id, closed_at)
  WHERE closed_at IS NULL;
