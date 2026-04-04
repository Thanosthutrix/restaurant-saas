-- Lignes extraites facture fournisseur (normalisées, hors matching stock).
CREATE TABLE IF NOT EXISTS supplier_invoice_extracted_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id uuid NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  label text NOT NULL,
  quantity numeric,
  unit text,
  unit_price numeric,
  line_total numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_siel_invoice ON supplier_invoice_extracted_lines(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_siel_invoice_sort ON supplier_invoice_extracted_lines(supplier_invoice_id, sort_order);

COMMENT ON TABLE supplier_invoice_extracted_lines IS 'Lignes lues sur la facture (IA/OCR). Source de vérité affichage après sync ; analysis_result_json peut rester en archive.';
