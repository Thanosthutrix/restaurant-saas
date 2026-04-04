-- Lignes de ticket persistées par service (une ligne par article détecté ou ajouté).
-- Permet révision ligne par ligne, association à un plat, ignoré, puis ventes créées à la validation.
CREATE TABLE IF NOT EXISTS service_import_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  line_index int NOT NULL,
  raw_label text NOT NULL,
  qty numeric NOT NULL,
  dish_id uuid REFERENCES dishes(id) ON DELETE SET NULL,
  ignored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sil_qty_positive CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_service_import_lines_service ON service_import_lines(service_id);
CREATE INDEX IF NOT EXISTS idx_service_import_lines_dish ON service_import_lines(dish_id);

COMMENT ON TABLE service_import_lines IS 'Lignes extraites du ticket par service. dish_id = plat associé ; ignored = true ne génère pas de vente. Ventilation finale via service_sales après validation.';
