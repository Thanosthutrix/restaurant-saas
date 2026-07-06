-- Bucket public pour photos restaurant (portail B2C).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('restaurant-public', 'restaurant-public', true, 8388608)
    ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 8388608;
  END IF;
END $$;

COMMENT ON COLUMN public.restaurants.hygiene_score IS
  'Obsolète : le score affiché sur le portail B2C est calculé en direct depuis le module hygiène ERP.';

COMMENT ON COLUMN public.restaurants.opening_hours IS
  'Obsolète : les horaires affichés sur le portail B2C proviennent de planning_opening_hours.';
