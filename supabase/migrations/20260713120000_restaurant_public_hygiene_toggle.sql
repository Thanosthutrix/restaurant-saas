-- Préférence restaurateur : afficher ou masquer le score hygiène sur le portail B2C.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS show_public_hygiene_score boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.restaurants.show_public_hygiene_score IS
  'Si false, le score hygiène live n''est pas affiché sur l''annuaire et la fiche publique.';
