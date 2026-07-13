-- Réglages moteur de paie 2026 : AT/MP, code APE, taux PAS salarié.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS payroll_atmp_rate numeric,
  ADD COLUMN IF NOT EXISTS ape_code text;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS chk_restaurants_payroll_atmp_rate;

ALTER TABLE public.restaurants
  ADD CONSTRAINT chk_restaurants_payroll_atmp_rate CHECK (
    payroll_atmp_rate IS NULL OR (payroll_atmp_rate >= 0 AND payroll_atmp_rate <= 20)
  );

COMMENT ON COLUMN public.restaurants.payroll_atmp_rate IS
  'Taux AT/MP patronal (%) — transmis par la caisse, défaut restauration ~2,30 %.';

COMMENT ON COLUMN public.restaurants.ape_code IS
  'Code APE/NAF de l''établissement (mention obligatoire bulletin).';

UPDATE public.restaurants
SET payroll_atmp_rate = 2.30
WHERE payroll_atmp_rate IS NULL;

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS withholding_tax_rate_pct numeric;

ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS chk_staff_members_withholding_tax_rate;

ALTER TABLE public.staff_members
  ADD CONSTRAINT chk_staff_members_withholding_tax_rate CHECK (
    withholding_tax_rate_pct IS NULL
    OR (withholding_tax_rate_pct >= 0 AND withholding_tax_rate_pct <= 100)
  );

COMMENT ON COLUMN public.staff_members.withholding_tax_rate_pct IS
  'Taux de prélèvement à la source (PAS) personnalisé du salarié, en %.';
