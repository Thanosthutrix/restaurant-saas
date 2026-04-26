-- Mémo service : rappels visibles en salle / caisse sur les tickets (ex. suivi personnel annoncé au comptoir).

ALTER TABLE public.restaurant_customers
  ADD COLUMN IF NOT EXISTS service_memo text;

COMMENT ON COLUMN public.restaurant_customers.service_memo IS
  'Rappel rapide pour l’équipe (salle, caisse), affiché sur la commande lorsque la fiche est liée.';
