-- Statut intermédiaire pendant l’étape refine / texture_model du pipeline Tripo3D.
ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS chk_dishes_model_3d_status;
ALTER TABLE public.dishes ADD CONSTRAINT chk_dishes_model_3d_status
  CHECK (
    model_3d_status IS NULL
    OR model_3d_status IN ('queued', 'running', 'refining', 'success', 'failed', 'cancelled', 'expired')
  );
