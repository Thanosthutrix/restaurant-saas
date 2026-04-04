-- Analyse facture fournisseur : résultat structuré (OCR / IA) sans toucher au stock.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supplier_invoices') THEN
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS analysis_result_json jsonb;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS analysis_status text;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS analysis_error text;
    ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS analysis_version text;
  END IF;
END $$;

COMMENT ON COLUMN supplier_invoices.analysis_result_json IS 'Résultat structuré d''analyse (métadonnées + lignes extraites). Convention applicative V1.';
