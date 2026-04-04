-- Rapprochement facture / réceptions V1
-- Étend supplier_invoices, ajoute la table pivot, bucket Storage.

-- 1) supplier_invoices : colonnes manquantes et statuts V1
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supplier_invoices') THEN
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS invoice_date date;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS file_name text;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS file_url text;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS amount_ht numeric;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS amount_ttc numeric;

    UPDATE supplier_invoices SET status = 'linked' WHERE status = 'matched';
    UPDATE supplier_invoices SET status = 'reviewed' WHERE status = 'paid';
    ALTER TABLE supplier_invoices DROP CONSTRAINT IF EXISTS chk_supplier_invoices_status;
    ALTER TABLE supplier_invoices ADD CONSTRAINT chk_supplier_invoices_status
      CHECK (status IN ('draft', 'linked', 'reviewed'));
  END IF;
END $$;

-- 2) Table pivot facture <-> réceptions (V1 : une réception = au plus une facture)
CREATE TABLE IF NOT EXISTS supplier_invoice_delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  delivery_note_id uuid NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_note_id)
);

CREATE INDEX IF NOT EXISTS idx_sidn_invoice ON supplier_invoice_delivery_notes(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_sidn_delivery_note ON supplier_invoice_delivery_notes(delivery_note_id);

COMMENT ON TABLE supplier_invoice_delivery_notes IS 'Rapprochement V1 : une facture peut avoir plusieurs réceptions ; une réception au plus une facture.';

-- 3) Bucket Storage factures fournisseur
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('supplier-invoices', 'supplier-invoices', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 4) Policies Storage pour supplier-invoices
DROP POLICY IF EXISTS "Allow anon insert supplier-invoices" ON storage.objects;
CREATE POLICY "Allow anon insert supplier-invoices"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'supplier-invoices');

DROP POLICY IF EXISTS "Allow authenticated insert supplier-invoices" ON storage.objects;
CREATE POLICY "Allow authenticated insert supplier-invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'supplier-invoices');

DROP POLICY IF EXISTS "Allow public read supplier-invoices" ON storage.objects;
CREATE POLICY "Allow public read supplier-invoices"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'supplier-invoices');
