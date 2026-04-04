-- Brouillons de commande fournisseur : statut et lignes, pour préparer l'envoi.
CREATE TABLE IF NOT EXISTS order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  message_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_order_drafts_status CHECK (status IN ('draft', 'ready_to_send', 'sent', 'confirmed'))
);

CREATE TABLE IF NOT EXISTS order_draft_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_draft_id uuid NOT NULL REFERENCES order_drafts(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  CONSTRAINT chk_odl_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_drafts_restaurant ON order_drafts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_drafts_supplier ON order_drafts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_order_draft_lines_draft ON order_draft_lines(order_draft_id);

COMMENT ON TABLE order_drafts IS 'Brouillon de commande par fournisseur : statut (draft / ready_to_send / sent / confirmed), message prêt à envoyer.';
COMMENT ON TABLE order_draft_lines IS 'Lignes du brouillon : composant et quantité (en unité d''achat).';
