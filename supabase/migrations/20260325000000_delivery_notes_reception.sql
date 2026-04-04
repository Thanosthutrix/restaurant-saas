-- Réception fournisseur / bon de livraison structuré
-- Étend delivery_notes et delivery_note_lines existants pour supporter :
-- - création depuis une commande
-- - saisie qty commandée / livrée / reçue
-- - validation de la réception (stock géré côté code)

-- 1) delivery_notes : nouveaux champs métier
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_notes') THEN
    ALTER TABLE delivery_notes
      ADD COLUMN IF NOT EXISTS number text,
      ADD COLUMN IF NOT EXISTS delivery_date date,
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'from_purchase_order',
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS file_url text,
      ADD COLUMN IF NOT EXISTS raw_text text;

    -- Détendre file_path / file_name pour permettre des BL sans fichier
    ALTER TABLE delivery_notes
      ALTER COLUMN file_path DROP NOT NULL,
      ALTER COLUMN file_name DROP NOT NULL;

    -- Statut : on accepte 'draft', 'received' (legacy) et 'validated'
    ALTER TABLE delivery_notes
      DROP CONSTRAINT IF EXISTS chk_delivery_notes_status;
    ALTER TABLE delivery_notes
      ADD CONSTRAINT chk_delivery_notes_status
        CHECK (status IN ('draft', 'received', 'validated'));
  END IF;
END $$;

-- 2) delivery_note_lines : structure des lignes de BL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_note_lines') THEN
    ALTER TABLE delivery_note_lines
      ADD COLUMN IF NOT EXISTS purchase_order_line_id uuid REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS label text,
      ADD COLUMN IF NOT EXISTS qty_ordered numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS qty_delivered numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS qty_received numeric NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS unit text,
      ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    -- Contraintes / valeurs par défaut
    UPDATE delivery_note_lines
    SET label = COALESCE(label, 'Ligne')
    WHERE label IS NULL;

    ALTER TABLE delivery_note_lines
      ALTER COLUMN label SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_note_lines_po_line ON delivery_note_lines(purchase_order_line_id);

