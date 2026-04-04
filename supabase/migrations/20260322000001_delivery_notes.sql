-- Bons de livraison : document uploadé, rattaché au fournisseur et optionnellement à une commande.
CREATE TABLE IF NOT EXISTS delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_delivery_notes_status CHECK (status IN ('draft', 'received'))
);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_restaurant ON delivery_notes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_supplier ON delivery_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_po ON delivery_notes(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_created ON delivery_notes(created_at DESC);

COMMENT ON TABLE delivery_notes IS 'BL enregistrés : fichier stocké (file_path), rattaché au fournisseur et éventuellement à une commande. Rapprochement facture préparé pour plus tard.';
COMMENT ON COLUMN delivery_notes.status IS 'draft = enregistré ; received = réception validée (mouvement de stock fait ailleurs si prévu).';
