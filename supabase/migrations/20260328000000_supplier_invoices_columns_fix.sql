-- Alignement socle factures fournisseur : garantir toutes les colonnes utilisées par le code.
-- Idempotent : ADD COLUMN IF NOT EXISTS pour chaque colonne possiblement absente.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supplier_invoices') THEN
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS invoice_date date;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS file_path text;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS file_name text;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS file_url text;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS amount_ht numeric;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS amount_ttc numeric;

    -- Statuts attendus par le code : draft, linked, reviewed
    ALTER TABLE supplier_invoices DROP CONSTRAINT IF EXISTS chk_supplier_invoices_status;
    ALTER TABLE supplier_invoices ADD CONSTRAINT chk_supplier_invoices_status
      CHECK (status IN ('draft', 'linked', 'reviewed'));
  END IF;
END $$;
