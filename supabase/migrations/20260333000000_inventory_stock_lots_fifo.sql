-- Couche 3 — FIFO : lots (entrées) et allocations (sorties → lots consommés).
-- Étapes métier : (1) entrée achat ou ajustement + → lot ; (2) sortie conso / ajustement - → allocations FIFO ;
-- (3) annulation service → restitution des lots puis suppression des mouvements de consommation.
--
-- Pas de backfill automatique des mouvements d’achat historiques : les lots ne sont créés qu’à partir
-- de cette migration pour les nouvelles écritures ; les anciennes sorties peuvent avoir un coût « inconnu »
-- (allocations sans lot) jusqu’à ce que le stock soit renouvelé par des réceptions valorisées.

CREATE TABLE IF NOT EXISTS inventory_stock_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  source_stock_movement_id uuid NOT NULL UNIQUE REFERENCES stock_movements(id) ON DELETE RESTRICT,
  qty_initial numeric NOT NULL,
  qty_remaining numeric NOT NULL,
  unit_cost numeric,
  opened_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_inventory_stock_lots_qty_initial_positive CHECK (qty_initial > 0),
  CONSTRAINT chk_inventory_stock_lots_remaining_range CHECK (
    qty_remaining >= 0 AND qty_remaining <= qty_initial
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_lots_fifo
  ON inventory_stock_lots (restaurant_id, inventory_item_id, opened_at ASC);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_lots_restaurant_item
  ON inventory_stock_lots (restaurant_id, inventory_item_id);

COMMENT ON TABLE inventory_stock_lots IS 'Couche de valorisation FIFO : une ligne par mouvement d’entrée (achat ou ajustement positif). qty_remaining diminue lors des sorties allouées.';
COMMENT ON COLUMN inventory_stock_lots.unit_cost IS 'Coût unitaire en unité de stock (inventory_items.unit), même devise que la compta métier ; NULL si inconnu.';

CREATE TABLE IF NOT EXISTS stock_lot_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_stock_movement_id uuid NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES inventory_stock_lots(id) ON DELETE SET NULL,
  quantity numeric NOT NULL,
  unit_cost numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_stock_lot_allocations_qty_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_lot_allocations_outbound
  ON stock_lot_allocations (outbound_stock_movement_id);

CREATE INDEX IF NOT EXISTS idx_stock_lot_allocations_lot
  ON stock_lot_allocations (lot_id)
  WHERE lot_id IS NOT NULL;

COMMENT ON TABLE stock_lot_allocations IS 'Lien sortie → lot(s) FIFO. lot_id NULL = quantité sortie sans lot (coût inconnu, ex. historique sans lots).';
COMMENT ON COLUMN stock_lot_allocations.unit_cost IS 'Snapshot du coût du lot au moment de l’allocation (pour CMP / historique).';

-- Valeur de stock connue (coûts non NULL uniquement dans la somme produit ; les lots sans coût sont exclus de value_at_known_cost)
CREATE OR REPLACE VIEW inventory_stock_fifo_value AS
SELECT
  l.restaurant_id,
  l.inventory_item_id,
  SUM(l.qty_remaining) AS qty_remaining_total,
  SUM(
    CASE
      WHEN l.unit_cost IS NOT NULL THEN l.qty_remaining * l.unit_cost
      ELSE 0
    END
  ) AS value_at_known_cost
FROM inventory_stock_lots l
GROUP BY l.restaurant_id, l.inventory_item_id;

COMMENT ON VIEW inventory_stock_fifo_value IS 'Stock restant par article et valeur estimée (lots avec unit_cost renseigné uniquement).';
