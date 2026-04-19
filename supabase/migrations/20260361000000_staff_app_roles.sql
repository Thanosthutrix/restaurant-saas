-- Rôles applicatifs pour les collaborateurs (accès menu / sections une fois user_id lié).

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS app_role text;

COMMENT ON COLUMN public.staff_members.app_role IS
  'Rôle applicatif : manager, service, cuisine, hygiene, achats, lecture_seule. Le propriétaire du restaurant ignore ce champ (accès total).';

ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS chk_staff_members_app_role;
ALTER TABLE public.staff_members
  ADD CONSTRAINT chk_staff_members_app_role CHECK (
    app_role IS NULL
    OR app_role IN (
      'manager',
      'service',
      'cuisine',
      'hygiene',
      'achats',
      'lecture_seule'
    )
  );

UPDATE public.staff_members
SET app_role = 'lecture_seule'
WHERE app_role IS NULL;
