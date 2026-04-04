-- Stock de base sur les composants stock (inventory_items).
-- Pas de mouvements de stock : juste quantité actuelle + seuil mini optionnel.

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS current_stock_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock_qty numeric;

ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS chk_inventory_items_current_stock_qty_non_negative;
ALTER TABLE inventory_items
  ADD CONSTRAINT chk_inventory_items_current_stock_qty_non_negative
  CHECK (current_stock_qty >= 0);

ALTER TABLE inventory_items
  DROP CONSTRAINT IF EXISTS chk_inventory_items_min_stock_qty_non_negative;
ALTER TABLE inventory_items
  ADD CONSTRAINT chk_inventory_items_min_stock_qty_non_negative
  CHECK (min_stock_qty IS NULL OR min_stock_qty >= 0);

COMMENT ON COLUMN inventory_items.current_stock_qty IS 'Quantité en stock actuelle (unité de référence).';
COMMENT ON COLUMN inventory_items.min_stock_qty IS 'Seuil minimum optionnel (alerte réappro).';
