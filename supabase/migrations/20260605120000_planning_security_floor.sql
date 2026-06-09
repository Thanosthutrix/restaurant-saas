-- Talon de sécurité (effectif minimum simultané) pendant l'ouverture.
-- Utilisé par le wizard d'ébauche (Étape 4) et le moteur de contraintes (HARD: < talon = éliminatoire).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS planning_security_floor integer NOT NULL DEFAULT 2;

COMMENT ON COLUMN public.restaurants.planning_security_floor IS
  'Effectif minimum simultané requis sur site pendant l''ouverture (talon de sécurité). Défaut 2 (jamais une personne seule).';
