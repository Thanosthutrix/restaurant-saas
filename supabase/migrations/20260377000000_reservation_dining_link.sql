-- Lien réservation → table salle + ticket (commande) ouvert

ALTER TABLE public.restaurant_reservations
  ADD COLUMN IF NOT EXISTS dining_table_id uuid REFERENCES public.dining_tables (id) ON DELETE SET NULL;

ALTER TABLE public.restaurant_reservations
  ADD COLUMN IF NOT EXISTS dining_order_id uuid REFERENCES public.dining_orders (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_dining_table
  ON public.restaurant_reservations (dining_table_id)
  WHERE dining_table_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_dining_order
  ON public.restaurant_reservations (dining_order_id)
  WHERE dining_order_id IS NOT NULL;

COMMENT ON COLUMN public.restaurant_reservations.dining_table_id IS
  'Table assignée quand le statut devient « assis ».';

COMMENT ON COLUMN public.restaurant_reservations.dining_order_id IS
  'Ticket salle (dining_orders) ouvert pour ce groupe, si encore actif.';
