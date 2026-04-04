-- Couche 1 : mouvements de stock (journal append-only, source de vérité future).
-- Le stock affiché (inventory_items.current_stock_qty) reste la référence opérationnelle
-- jusqu’à migration explicite vers un stock calculé (couche 2).

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  movement_type text NOT NULL,
  unit_cost numeric,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  delivery_note_id uuid REFERENCES delivery_notes(id) ON DELETE SET NULL,
  delivery_note_line_id uuid REFERENCES delivery_note_lines(id) ON DELETE SET NULL,
  supplier_invoice_id uuid REFERENCES supplier_invoices(id) ON DELETE SET NULL,
  reference_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT chk_stock_movements_quantity_non_zero CHECK (quantity != 0),
  CONSTRAINT chk_stock_movements_movement_type CHECK (
    movement_type IN ('purchase', 'consumption', 'adjustment', 'inventory_count')
  ),
  CONSTRAINT chk_stock_movements_unit_non_empty CHECK (length(trim(unit)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_restaurant_item_time
  ON stock_movements (restaurant_id, inventory_item_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_delivery_note
  ON stock_movements (delivery_note_id) WHERE delivery_note_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier_invoice
  ON stock_movements (supplier_invoice_id) WHERE supplier_invoice_id IS NOT NULL;

COMMENT ON TABLE stock_movements IS 'Journal des mouvements de stock. Quantité en unité de stock (inventory_items.unit) ; positif = entrée, négatif = sortie.';
COMMENT ON COLUMN stock_movements.unit_cost IS 'Coût unitaire au moment du mouvement (ex. achat). Réservé couche valorisation / FIFO ultérieure.';
COMMENT ON COLUMN stock_movements.supplier_invoice_id IS 'Lien optionnel vers facture fournisseur si la réception est rapprochée.';

-- Une entrée d’achat par ligne de BL (évite doublon si rejeu partiel).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_stock_movements_purchase_dn_line
  ON stock_movements (delivery_note_line_id)
  WHERE delivery_note_line_id IS NOT NULL AND movement_type = 'purchase';
