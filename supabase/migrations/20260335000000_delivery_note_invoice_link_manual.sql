-- Liaison explicite ligne BL → ligne facture extraite ; prix unitaire stock saisi manuellement (prioritaire).

ALTER TABLE delivery_note_lines
  ADD COLUMN IF NOT EXISTS supplier_invoice_extracted_line_id uuid REFERENCES supplier_invoice_extracted_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manual_unit_price_stock_ht numeric;

COMMENT ON COLUMN delivery_note_lines.supplier_invoice_extracted_line_id IS 'Ligne de facture (extraite) à utiliser pour le coût ; doit appartenir à la facture liée à la réception.';
COMMENT ON COLUMN delivery_note_lines.manual_unit_price_stock_ht IS 'Coût unitaire HT saisi (€ / unité de stock), prioritaire sur tout le reste si > 0.';

CREATE INDEX IF NOT EXISTS idx_delivery_note_lines_invoice_extracted_line
  ON delivery_note_lines (supplier_invoice_extracted_line_id)
  WHERE supplier_invoice_extracted_line_id IS NOT NULL;
