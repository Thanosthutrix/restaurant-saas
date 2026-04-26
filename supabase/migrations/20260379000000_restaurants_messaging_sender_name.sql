-- Nom affiché pour l’expéditeur des e-mails transactionnels (Resend) : « Nom <adresse> ».

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS messaging_sender_display_name text;

COMMENT ON COLUMN public.restaurants.messaging_sender_display_name IS
  'Libellé expéditeur (From) pour les e-mails ; si vide, le nom du restaurant est utilisé.';
