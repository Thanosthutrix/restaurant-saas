-- Petit matériel non consommable (verres, carafes, couverts…) : type supply + casse dédiée.

ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_items_item_type;
ALTER TABLE inventory_items ADD CONSTRAINT chk_inventory_items_item_type
  CHECK (item_type IN ('ingredient', 'prep', 'resale', 'supply'));

COMMENT ON COLUMN inventory_items.item_type IS
  'ingredient, prep, resale (alimentaire/commercial) ou supply (vaisselle, verrerie, couverts…).';

ALTER TABLE waste_logs DROP CONSTRAINT IF EXISTS chk_waste_logs_type;
ALTER TABLE waste_logs ADD CONSTRAINT chk_waste_logs_type
  CHECK (waste_type IN ('raw', 'prep', 'plate', 'supply'));

ALTER TABLE waste_logs DROP CONSTRAINT IF EXISTS chk_waste_logs_reason;
ALTER TABLE waste_logs ADD CONSTRAINT chk_waste_logs_reason
  CHECK (reason IN ('dlc', 'cooking', 'dropped', 'quality', 'other', 'breakage'));

COMMENT ON COLUMN waste_logs.waste_type IS
  'raw = matière brute, prep = préparation, plate = assiette, supply = vaisselle / petit matériel.';
COMMENT ON COLUMN waste_logs.reason IS
  'dlc, cooking, dropped, quality, other, breakage (casse vaisselle / matériel).';
