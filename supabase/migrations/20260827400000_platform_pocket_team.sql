-- Ma poche Ubion : charges fixes, paramètres, équipe & planning interne

ALTER TABLE public.platform_companies
  ADD COLUMN IF NOT EXISTS pocket_tax_pct numeric,
  ADD COLUMN IF NOT EXISTS payroll_employer_pct numeric NOT NULL DEFAULT 42;

CREATE TABLE IF NOT EXISTS public.platform_fixed_charges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  label           text NOT NULL,
  monthly_amount  numeric NOT NULL DEFAULT 0,
  category        text NOT NULL DEFAULT 'divers',
  periodicity     text NOT NULL DEFAULT 'monthly',
  active          boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_fixed_charges_label CHECK (length(trim(label)) > 0),
  CONSTRAINT chk_platform_fixed_charges_amount CHECK (monthly_amount >= 0),
  CONSTRAINT chk_platform_fixed_charges_periodicity CHECK (
    periodicity IN ('monthly', 'quarterly', 'yearly')
  ),
  CONSTRAINT chk_platform_fixed_charges_category CHECK (
    category IN (
      'infra_hebergement',
      'logiciels_saas',
      'marketing',
      'rh_personnel',
      'prestataires',
      'bureaux',
      'loyer',
      'assurances',
      'impots_taxes',
      'financier',
      'divers'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_fixed_charges_company
  ON public.platform_fixed_charges (company_id, active, sort_order);

ALTER TABLE public.platform_fixed_charges ENABLE ROW LEVEL SECURITY;

-- Nouvelles catégories de dépenses (loyer, assurances)
ALTER TABLE public.platform_invoices DROP CONSTRAINT IF EXISTS chk_platform_invoices_expense_category;
ALTER TABLE public.platform_invoices ADD CONSTRAINT chk_platform_invoices_expense_category CHECK (
  expense_category IS NULL OR expense_category IN (
    'infra_hebergement',
    'logiciels_saas',
    'marketing',
    'rh_personnel',
    'prestataires',
    'bureaux',
    'loyer',
    'assurances',
    'impots_taxes',
    'financier',
    'divers'
  )
);

-- Équipe interne Ubion (planning)
CREATE TABLE IF NOT EXISTS public.platform_staff_members (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  display_name            text NOT NULL,
  role_label              text,
  hourly_gross_rate       numeric,
  withholding_tax_rate_pct numeric,
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_staff_name CHECK (length(trim(display_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_staff_company
  ON public.platform_staff_members (company_id)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS public.platform_work_shifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES public.platform_staff_members(id) ON DELETE CASCADE,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_work_shift_times CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_platform_work_shifts_company
  ON public.platform_work_shifts (company_id, starts_at);

ALTER TABLE public.platform_staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_work_shifts ENABLE ROW LEVEL SECURITY;
