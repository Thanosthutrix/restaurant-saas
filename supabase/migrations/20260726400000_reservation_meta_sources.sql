-- Sources réservation depuis Instagram DM / Messenger.

ALTER TABLE public.restaurant_reservations
  DROP CONSTRAINT IF EXISTS restaurant_reservations_source_check;

ALTER TABLE public.restaurant_reservations
  ADD CONSTRAINT restaurant_reservations_source_check
  CHECK (source IN (
    'phone',
    'walk_in',
    'website',
    'other',
    'instagram_dm',
    'facebook_messenger'
  ));

COMMENT ON COLUMN public.restaurant_reservations.source IS
  'Canal de la réservation (ERP, site, Instagram DM, Messenger, …).';
