-- Société éditrice Ubion (compta interne, sans restaurant)

CREATE TABLE IF NOT EXISTS public.platform_companies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name          text NOT NULL,
  legal_form          text,
  siren               text,
  siret               text,
  rcs_ville           text,
  capital             text,
  address             text,
  representative_name text,
  representative_role text,
  contact_email       text,
  ape_code            text,
  vat_number          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_companies_legal_name CHECK (length(trim(legal_name)) > 0)
);

ALTER TABLE public.platform_companies ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.platform_companies IS
  'Profil juridique de la société éditrice Ubion (indépendant des restaurants clients).';

CREATE TABLE IF NOT EXISTS public.platform_suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text,
  siret       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_suppliers_name CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_suppliers_company
  ON public.platform_suppliers (company_id, name);

ALTER TABLE public.platform_suppliers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  supplier_id          uuid REFERENCES public.platform_suppliers(id) ON DELETE SET NULL,
  supplier_name        text,
  invoice_number       text,
  invoice_date         date,
  amount_ht            numeric,
  amount_ttc           numeric,
  expense_category     text,
  file_path            text,
  file_name            text,
  status               text NOT NULL DEFAULT 'draft',
  notes                text,
  analysis_status      text,
  analysis_result_json jsonb,
  analysis_error       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_invoices_status CHECK (status IN ('draft', 'reviewed')),
  CONSTRAINT chk_platform_invoices_expense_category CHECK (
    expense_category IS NULL OR expense_category IN (
      'infra_hebergement',
      'logiciels_saas',
      'marketing',
      'rh_personnel',
      'prestataires',
      'bureaux',
      'impots_taxes',
      'financier',
      'divers'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_company
  ON public.platform_invoices (company_id, invoice_date DESC NULLS LAST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_status
  ON public.platform_invoices (company_id, status);

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.platform_invoices IS
  'Factures fournisseurs de la société Ubion — import, contrôle, préparation comptable.';
