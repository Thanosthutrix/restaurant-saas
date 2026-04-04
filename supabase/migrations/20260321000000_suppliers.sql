-- Fournisseurs : coordonnées, jours de commande, méthode préférée.
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  whatsapp_phone text,
  address text,
  notes text,
  preferred_order_method text NOT NULL DEFAULT 'EMAIL',
  order_days text[] NOT NULL DEFAULT '{}',
  cut_off_time time,
  lead_time_days int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_suppliers_name_non_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT chk_suppliers_preferred_order_method CHECK (preferred_order_method IN ('EMAIL', 'WHATSAPP', 'PHONE', 'PORTAL'))
);

CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant ON suppliers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant_active ON suppliers(restaurant_id) WHERE is_active = true;

COMMENT ON TABLE suppliers IS 'Fournisseurs du restaurant : coordonnées, jours de commande, canal préféré.';
COMMENT ON COLUMN suppliers.order_days IS 'Jours où on peut commander (ex: {monday, thursday}).';
COMMENT ON COLUMN suppliers.preferred_order_method IS 'Canal privilégié pour envoyer la commande.';
