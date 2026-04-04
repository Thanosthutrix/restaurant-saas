-- Socle SaaS : table restaurants liée à l'utilisateur (auth.users).
-- Utilise ALTER ADD COLUMN IF NOT EXISTS pour ne pas casser une table restaurants déjà existante (ex. id + name).

-- 1) Créer la table avec le strict minimum si elle n'existe pas
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

-- 2) Ajouter les colonnes manquantes (ordre sans dépendance)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS activity_type text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS avg_covers int;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3) Contrainte sur name (si pas déjà présente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'restaurants' AND c.conname = 'chk_restaurants_name_non_empty'
  ) THEN
    ALTER TABLE restaurants ADD CONSTRAINT chk_restaurants_name_non_empty
      CHECK (length(trim(name)) > 0);
  END IF;
END $$;

-- 4) Index (créés si pas existants)
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restaurants_created_at ON restaurants(created_at);

COMMENT ON TABLE restaurants IS 'Un restaurant par compte (owner_id = auth.uid()). Données onboarding : nom, activité, couverts, type de service.';
