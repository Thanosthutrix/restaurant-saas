-- Prix saisis sur le BL (€ HT). Priorité métier à la validation : total ligne / qté reçue (stock), sinon prix unitaire stock.

ALTER TABLE delivery_note_lines
  ADD COLUMN IF NOT EXISTS bl_line_total_ht numeric,
  ADD COLUMN IF NOT EXISTS bl_unit_price_stock_ht numeric;

COMMENT ON COLUMN delivery_note_lines.bl_line_total_ht IS 'Total ligne HT indiqué sur le BL (€). Coût unitaire stock = total / qty_received si renseigné.';
COMMENT ON COLUMN delivery_note_lines.bl_unit_price_stock_ht IS 'Prix unitaire HT sur le BL en unité de stock (€ / g, ml, unit…).';
