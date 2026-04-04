-- Salle : tables physiques, commandes ouvertes, lignes, paiements à l’encaissement.
-- Une commande réglée crée un service + service_sales (comme un relevé) pour stock et marges.

CREATE TABLE IF NOT EXISTS public.dining_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dining_tables_restaurant_label UNIQUE (restaurant_id, label)
);

CREATE INDEX IF NOT EXISTS idx_dining_tables_restaurant ON public.dining_tables (restaurant_id);

COMMENT ON TABLE public.dining_tables IS 'Tables de salle (libellé affiché : 1, T12, etc.).';

CREATE TABLE IF NOT EXISTS public.dining_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  dining_table_id uuid NOT NULL REFERENCES public.dining_tables(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dining_orders_restaurant ON public.dining_orders (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dining_orders_table ON public.dining_orders (dining_table_id);
CREATE INDEX IF NOT EXISTS idx_dining_orders_status ON public.dining_orders (restaurant_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dining_orders_one_open_per_table
  ON public.dining_orders (dining_table_id)
  WHERE status = 'open';

COMMENT ON TABLE public.dining_orders IS 'Commande en salle : open = en cours, settled = encaissée (service_id renseigné).';

CREATE TABLE IF NOT EXISTS public.dining_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  dining_order_id uuid NOT NULL REFERENCES public.dining_orders(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE RESTRICT,
  qty numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dining_order_lines_qty CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_dining_order_lines_order ON public.dining_order_lines (dining_order_id);

CREATE TABLE IF NOT EXISTS public.dining_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  dining_order_id uuid NOT NULL REFERENCES public.dining_orders(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'other')),
  amount_ttc numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dining_payment_amount CHECK (amount_ttc > 0)
);

CREATE INDEX IF NOT EXISTS idx_dining_payments_order ON public.dining_order_payments (dining_order_id);
CREATE INDEX IF NOT EXISTS idx_dining_payments_restaurant_created ON public.dining_order_payments (restaurant_id, created_at DESC);

COMMENT ON TABLE public.dining_order_payments IS 'Encaissement TTC associé à une commande salle (MVP : un paiement par commande).';
