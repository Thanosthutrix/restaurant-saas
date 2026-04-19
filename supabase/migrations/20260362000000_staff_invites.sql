-- Invitations collaborateur : lien unique pour lier un compte à une fiche staff.

CREATE TABLE IF NOT EXISTS public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token_pending
  ON public.staff_invites (token)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE public.staff_invites IS
  'Invitation à lier auth.users à staff_members ; un seul jeton actif par fiche (remplacé à chaque nouvelle génération).';
