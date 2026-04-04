-- Restreindre l'unité des composants stock à : g, ml, unit.
-- La colonne unit existe déjà sur inventory_items (NOT NULL, non vide).

-- 1) Mettre à jour les valeurs non autorisées (ex. "kg", "L", "pièce") vers 'unit'
UPDATE inventory_items
SET unit = 'unit'
WHERE trim(lower(unit)) NOT IN ('g', 'ml', 'unit');

-- 2) Normaliser les valeurs existantes (minuscule, trim)
UPDATE inventory_items
SET unit = lower(trim(unit))
WHERE unit <> lower(trim(unit));

-- 3) Remplacer l'ancienne contrainte "non vide" par la liste autorisée
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_items_unit_non_empty;
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_items_unit_allowed;
ALTER TABLE inventory_items ADD CONSTRAINT chk_inventory_items_unit_allowed
  CHECK (trim(lower(unit)) IN ('g', 'ml', 'unit'));

COMMENT ON COLUMN inventory_items.unit IS 'Unité de référence : g, ml ou unit.';
