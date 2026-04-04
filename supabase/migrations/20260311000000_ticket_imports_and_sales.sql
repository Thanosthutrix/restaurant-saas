-- Migration : socle "ventes" — imports de tickets, lignes, ventes
-- Tables : ticket_imports, ticket_import_lines, sales
-- Traçabilité : ticket_import → lignes (avec ou sans plat) → ventes (lignes matchées regroupées par plat)

-- 1) ticket_imports : un enregistrement = un ticket importé (une photo, un fichier, une saisie)
CREATE TABLE IF NOT EXISTS ticket_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  service_date date,
  service_type text,
  image_url text,
  analysis_status text,
  analysis_result_json jsonb,
  analysis_error text,
  analysis_version text
);

CREATE INDEX IF NOT EXISTS idx_ticket_imports_restaurant ON ticket_imports(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_imports_service_date ON ticket_imports(service_date);
CREATE INDEX IF NOT EXISTS idx_ticket_imports_imported_at ON ticket_imports(imported_at);

COMMENT ON TABLE ticket_imports IS 'Un enregistrement par ticket importé (photo, fichier ou saisie). Lie la date/type de service et le résultat d''analyse IA si présent.';

-- 2) ticket_import_lines : chaque ligne du ticket (texte brut, quantité, plat matché si reconnu)
CREATE TABLE IF NOT EXISTS ticket_import_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_import_id uuid NOT NULL REFERENCES ticket_imports(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  line_index int NOT NULL,
  raw_label text NOT NULL,
  qty numeric NOT NULL,
  dish_id uuid REFERENCES dishes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_til_qty_positive CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS idx_ticket_import_lines_import ON ticket_import_lines(ticket_import_id);
CREATE INDEX IF NOT EXISTS idx_ticket_import_lines_dish ON ticket_import_lines(dish_id);

COMMENT ON TABLE ticket_import_lines IS 'Lignes extraites du ticket. dish_id rempli quand la ligne a été matchée à un plat ; les lignes sans dish_id ne génèrent pas de vente.';

-- 3) sales : ventes par ticket et par plat (lignes matchées regroupées)
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_import_id uuid NOT NULL REFERENCES ticket_imports(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  qty numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sales_qty_positive CHECK (qty > 0),
  CONSTRAINT uq_sales_import_dish UNIQUE (ticket_import_id, dish_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_ticket_import ON sales(ticket_import_id);
CREATE INDEX IF NOT EXISTS idx_sales_dish ON sales(dish_id);
CREATE INDEX IF NOT EXISTS idx_sales_restaurant ON sales(restaurant_id);

COMMENT ON TABLE sales IS 'Ventes enregistrées : une ligne par (ticket_import, plat) avec la quantité totale. Créées à partir des ticket_import_lines dont dish_id est renseigné.';
