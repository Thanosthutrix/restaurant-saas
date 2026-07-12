-- Bilan « Ma poche » : ce qui reste au restaurateur sur une période.
-- 1) Salaire brut horaire par employé (croisé avec work_shifts / pointage).
-- 2) Charges fixes récurrentes (loyer, assurances, énergie, abonnements…).
-- 3) Réglages : % charges patronales et % estimation impôts/cotisations dirigeant.

-- ── Salaire par employé ──────────────────────────────────────────────────────
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS hourly_gross_rate numeric;

ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS chk_staff_members_hourly_gross_rate;
ALTER TABLE public.staff_members
  ADD CONSTRAINT chk_staff_members_hourly_gross_rate CHECK (
    hourly_gross_rate IS NULL OR (hourly_gross_rate >= 0 AND hourly_gross_rate <= 500)
  );

COMMENT ON COLUMN public.staff_members.hourly_gross_rate IS
  'Salaire BRUT horaire (€) — utilisé par le bilan « Ma poche » (masse salariale temps réel).';

-- ── Charges fixes récurrentes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_fixed_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  monthly_amount numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fixed_charges_label_non_empty CHECK (length(trim(label)) > 0),
  CONSTRAINT chk_fixed_charges_amount CHECK (monthly_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fixed_charges_restaurant
  ON public.restaurant_fixed_charges (restaurant_id, active, sort_order);

COMMENT ON TABLE public.restaurant_fixed_charges IS
  'Charges fixes mensuelles (loyer, assurance, énergie…) proratisées dans le bilan « Ma poche ».';

-- Convention sécurité du projet : RLS deny-all sur toute nouvelle table
-- (l''app accède via service_role qui bypass ; la clé anon n''a aucun accès).
ALTER TABLE public.restaurant_fixed_charges ENABLE ROW LEVEL SECURITY;

-- ── Réglages bilan sur le restaurant ─────────────────────────────────────────
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS payroll_employer_pct numeric NOT NULL DEFAULT 42;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS pocket_tax_pct numeric;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS chk_restaurants_payroll_employer_pct;
ALTER TABLE public.restaurants
  ADD CONSTRAINT chk_restaurants_payroll_employer_pct CHECK (
    payroll_employer_pct >= 0 AND payroll_employer_pct <= 100
  );

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS chk_restaurants_pocket_tax_pct;
ALTER TABLE public.restaurants
  ADD CONSTRAINT chk_restaurants_pocket_tax_pct CHECK (
    pocket_tax_pct IS NULL OR (pocket_tax_pct >= 0 AND pocket_tax_pct <= 100)
  );

COMMENT ON COLUMN public.restaurants.payroll_employer_pct IS
  'Charges patronales estimées (% du brut) — défaut 42 %, à ajuster avec le comptable.';
COMMENT ON COLUMN public.restaurants.pocket_tax_pct IS
  'Estimation impôts + cotisations dirigeant (% du résultat positif) ; NULL = non affiché.';
