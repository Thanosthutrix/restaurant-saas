-- =============================================================================
-- Module achats : convention unique et structure alignée
-- =============================================================================
-- Convention métier : tout composant/produit stocké est référencé par
--   - table inventory_items
--   - clé étrangère inventory_item_id (jamais ingredient_id, component_id, item_id)
--
-- Règle métier stock :
--   - Générer une commande (purchase_order) ne modifie pas le stock.
--   - Seule une réception validée (ex. via BL validé) peut augmenter le stock.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. purchase_order_lines : renommages legacy -> inventory_item_id
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Si une colonne legacy existe et inventory_item_id n'existe pas, renommer
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_order_lines') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'ingredient_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'inventory_item_id') THEN
      ALTER TABLE purchase_order_lines RENAME COLUMN ingredient_id TO inventory_item_id;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'component_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'inventory_item_id') THEN
      ALTER TABLE purchase_order_lines RENAME COLUMN component_id TO inventory_item_id;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'item_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'inventory_item_id') THEN
      ALTER TABLE purchase_order_lines RENAME COLUMN item_id TO inventory_item_id;
    END IF;
  END IF;
END $$;

-- Index utile pour les jointures par composant (inventory_item_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'inventory_item_id') THEN
    CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_inventory_item ON purchase_order_lines(inventory_item_id);
  END IF;
END $$;

COMMENT ON COLUMN purchase_order_lines.inventory_item_id IS 'Référence inventory_items. Convention module achats : toujours inventory_item_id.';
COMMENT ON TABLE purchase_orders IS 'Commandes fournisseurs. Génération = pas de mouvement de stock ; seule une réception validée (BL) peut augmenter le stock.';

-- ---------------------------------------------------------------------------
-- 2. delivery_note_lines (lignes de BL, pour rapprochement futur)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery_note_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  received_qty_stock_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dnl_received_qty_non_negative CHECK (received_qty_stock_unit >= 0)
);

CREATE INDEX IF NOT EXISTS idx_delivery_note_lines_note ON delivery_note_lines(delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_lines_inventory_item ON delivery_note_lines(inventory_item_id);

COMMENT ON TABLE delivery_note_lines IS 'Lignes de BL : quantités reçues par composant (inventory_item_id). Pour rapprochement BL / commande et mise à jour stock.';
COMMENT ON COLUMN delivery_note_lines.inventory_item_id IS 'Convention module achats : toujours inventory_item_id.';

-- ---------------------------------------------------------------------------
-- 3. supplier_invoices (factures fournisseur, pour rapprochement futur)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_number text,
  file_path text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_supplier_invoices_status CHECK (status IN ('draft', 'matched', 'paid'))
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_restaurant ON supplier_invoices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices(supplier_id);

COMMENT ON TABLE supplier_invoices IS 'Factures fournisseur. Rapprochement BL / facture à faire côté applicatif.';

-- ---------------------------------------------------------------------------
-- 4. supplier_invoice_lines (lignes de facture)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL,
  unit_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sil_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_invoice ON supplier_invoice_lines(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_inventory_item ON supplier_invoice_lines(inventory_item_id);

COMMENT ON TABLE supplier_invoice_lines IS 'Lignes de facture fournisseur. Convention : inventory_item_id.';
COMMENT ON COLUMN supplier_invoice_lines.inventory_item_id IS 'Convention module achats : toujours inventory_item_id.';
