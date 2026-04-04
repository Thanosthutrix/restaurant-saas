-- Créer le bucket Storage pour les BL (bons de livraison).
-- Si storage.buckets n'existe pas (ex. Supabase local), créer le bucket "delivery-notes" depuis le dashboard (Storage).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('delivery-notes', 'delivery-notes', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
