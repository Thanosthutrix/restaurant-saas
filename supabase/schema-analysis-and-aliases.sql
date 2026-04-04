-- Colonnes d'analyse sur services (à exécuter dans Supabase SQL Editor)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS analysis_status text,
  ADD COLUMN IF NOT EXISTS analysis_result_json text,
  ADD COLUMN IF NOT EXISTS analysis_error text,
  ADD COLUMN IF NOT EXISTS analysis_version text;

-- Table dish_aliases : abréviations / alias par restaurant pour le matching ticket → plat
-- (logique d'utilisation à ajouter plus tard dans le matching)
CREATE TABLE IF NOT EXISTS dish_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dish_aliases_restaurant ON dish_aliases(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dish_aliases_dish ON dish_aliases(dish_id);

COMMENT ON TABLE dish_aliases IS 'Alias / abréviations des plats pour le matching ticket (ex: "Reine" → Pizza Reine).';
