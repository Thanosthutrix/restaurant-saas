-- Étendre les unités de stock : kg et l (litre), en plus de g, ml, unit.
-- La conversion achat reste « 1 unité achetée = X unités de stock » (units_per_purchase).

ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_items_unit_allowed;
ALTER TABLE inventory_items ADD CONSTRAINT chk_inventory_items_unit_allowed
  CHECK (trim(lower(unit)) IN ('g', 'kg', 'ml', 'l', 'unit'));

COMMENT ON COLUMN inventory_items.unit IS 'Unité de référence : g, kg, ml, l (litre) ou unit.';
