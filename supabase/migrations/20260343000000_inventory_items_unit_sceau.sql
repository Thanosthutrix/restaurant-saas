-- Unité de stock « sceau » (ex. frites, sauces en seau).
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_items_unit_allowed;
ALTER TABLE inventory_items ADD CONSTRAINT chk_inventory_items_unit_allowed
  CHECK (trim(lower(unit)) IN ('g', 'kg', 'ml', 'l', 'unit', 'sceau'));

COMMENT ON COLUMN inventory_items.unit IS 'Unité de référence : g, kg, ml, l (litre), unit ou sceau.';
