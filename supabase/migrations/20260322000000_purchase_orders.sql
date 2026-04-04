-- Commandes fournisseurs générées (historique). Ne modifient pas le stock.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'generated',
  generated_message text,
  expected_delivery_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_purchase_orders_status CHECK (status IN ('generated', 'expected_delivery', 'partially_received', 'received', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  ordered_qty_purchase_unit numeric NOT NULL,
  purchase_unit text NOT NULL,
  purchase_to_stock_ratio numeric NOT NULL,
  supplier_sku_snapshot text,
  item_name_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_pol_qty_positive CHECK (ordered_qty_purchase_unit > 0),
  CONSTRAINT chk_pol_ratio_positive CHECK (purchase_to_stock_ratio > 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_restaurant ON purchase_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_po ON purchase_order_lines(purchase_order_id);

COMMENT ON TABLE purchase_orders IS 'Commandes fournisseurs générées depuis les suggestions. Le stock n''est pas modifié à la création.';
COMMENT ON COLUMN purchase_orders.status IS 'generated = créée ; expected_delivery = livraison attendue ; received = réception validée (stock mis à jour ailleurs).';
COMMENT ON TABLE purchase_order_lines IS 'Lignes de commande avec snapshot (unité achat, ratio, nom article) pour traçabilité.';
