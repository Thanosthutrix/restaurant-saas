-- Dates de contrat saisies manuellement (contrats hors app ou complément HCR).

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS contract_start_date date NULL,
  ADD COLUMN IF NOT EXISTS contract_end_date date NULL;

COMMENT ON COLUMN public.staff_members.contract_start_date IS
  'Date d''entrée / début de contrat (CDI, CDD, etc.).';
COMMENT ON COLUMN public.staff_members.contract_end_date IS
  'Date de fin de contrat (CDD, intérim, stage…). NULL pour CDI.';

ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS chk_staff_members_contract_dates;

ALTER TABLE public.staff_members
  ADD CONSTRAINT chk_staff_members_contract_dates CHECK (
    contract_end_date IS NULL
    OR contract_start_date IS NULL
    OR contract_end_date >= contract_start_date
  );
