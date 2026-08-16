-- Destinataires push réservation + un token = un appareil actif

ALTER TABLE public.reservation_capacity_settings
  ADD COLUMN IF NOT EXISTS reservation_push_user_ids uuid[];

COMMENT ON COLUMN public.reservation_capacity_settings.reservation_push_user_ids IS
  'Utilisateurs (owner ou staff avec compte) recevant les push réservation. NULL = propriétaire seul.';

-- Un appareil (token) ne peut être actif que pour un seul compte à la fois
DELETE FROM public.user_push_tokens a
USING public.user_push_tokens b
WHERE a.token = b.token AND a.updated_at < b.updated_at;

CREATE UNIQUE INDEX IF NOT EXISTS user_push_tokens_token_unique
  ON public.user_push_tokens (token);
