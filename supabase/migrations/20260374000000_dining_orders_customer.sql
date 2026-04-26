-- Lier une commande (table ou comptoir) à une fiche client (habitudes, historique).

ALTER TABLE public.dining_orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.restaurant_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dining_orders_customer ON public.dining_orders(restaurant_id, customer_id)
  WHERE customer_id IS NOT NULL;

COMMENT ON COLUMN public.dining_orders.customer_id IS 'Fiche client optionnelle (ticket à un nom, table identifiée, etc.).';
