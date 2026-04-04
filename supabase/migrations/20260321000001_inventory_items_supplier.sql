-- Lien composant -> fournisseur principal + règles d'achat.
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_sku text,
  ADD COLUMN IF NOT EXISTS purchase_unit text,
  ADD COLUMN IF NOT EXISTS units_per_purchase numeric,
  ADD COLUMN IF NOT EXISTS min_order_quantity numeric,
  ADD COLUMN IF NOT EXISTS order_multiple numeric,
  ADD COLUMN IF NOT EXISTS target_stock_qty numeric;

CREATE INDEX IF NOT EXISTS idx_inventory_items_supplier ON inventory_items(supplier_id) WHERE supplier_id IS NOT NULL;

COMMENT ON COLUMN inventory_items.supplier_id IS 'Fournisseur principal pour ce composant.';
COMMENT ON COLUMN inventory_items.supplier_sku IS 'Référence / code article chez le fournisseur.';
COMMENT ON COLUMN inventory_items.purchase_unit IS 'Unité d''achat (ex: carton, pack, sachet).';
COMMENT ON COLUMN inventory_items.units_per_purchase IS 'Nombre d''unités de stock par unité d''achat (ex: 1 carton = 6 unit).';
COMMENT ON COLUMN inventory_items.min_order_quantity IS 'Quantité minimum à commander (en purchase_unit).';
COMMENT ON COLUMN inventory_items.order_multiple IS 'Commander par multiples de (en purchase_unit).';
COMMENT ON COLUMN inventory_items.target_stock_qty IS 'Stock cible à atteindre (en unité de stock). Si null, on utilise min_stock_qty pour les suggestions.';
