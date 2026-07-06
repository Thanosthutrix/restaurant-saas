-- Modèle 3D (RA) généré via Tripo3D pour les plats vendus.
ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS model_3d_url text,
  ADD COLUMN IF NOT EXISTS model_3d_source_image_url text,
  ADD COLUMN IF NOT EXISTS tripo_task_id text,
  ADD COLUMN IF NOT EXISTS model_3d_status text,
  ADD COLUMN IF NOT EXISTS model_3d_error text,
  ADD COLUMN IF NOT EXISTS model_3d_generated_at timestamptz;

ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS chk_dishes_model_3d_status;
ALTER TABLE public.dishes ADD CONSTRAINT chk_dishes_model_3d_status
  CHECK (
    model_3d_status IS NULL
    OR model_3d_status IN ('queued', 'running', 'refining', 'success', 'failed', 'cancelled', 'expired')
  );

COMMENT ON COLUMN public.dishes.model_3d_url IS 'URL publique du fichier .glb texturé (stockage Supabase ou CDN).';
COMMENT ON COLUMN public.dishes.tripo_task_id IS 'Identifiant de tâche Tripo3D pour le suivi de génération.';
COMMENT ON COLUMN public.dishes.model_3d_status IS 'Statut de la dernière génération 3D (Tripo3D).';

-- Bucket public pour photos sources et modèles .glb (RA).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('dish-ar', 'dish-ar', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
