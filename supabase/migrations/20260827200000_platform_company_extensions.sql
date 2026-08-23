-- Extensions société Ubion : PA, lignes OCR, contrats, factures émises

-- ── Réception PA (Portail Agréé) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_pa_connections (
  company_id                   uuid PRIMARY KEY REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  provider                     text NOT NULL DEFAULT 'super_pdp',
  provider_company_id          text,
  company_number               text,
  enrollment_status            text NOT NULL DEFAULT 'pending',
  company_verification_status  text,
  access_token                 text,
  refresh_token                text,
  token_expires_at             timestamptz,
  last_invoice_received_at     timestamptz,
  last_error                   text,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_pa_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_invoices
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS pa_provider text,
  ADD COLUMN IF NOT EXISTS pa_external_id text,
  ADD COLUMN IF NOT EXISTS pa_format text,
  ADD COLUMN IF NOT EXISTS pa_lifecycle_status text,
  ADD COLUMN IF NOT EXISTS pa_raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS analysis_version text;

ALTER TABLE public.platform_invoices DROP CONSTRAINT IF EXISTS chk_platform_invoices_source;
ALTER TABLE public.platform_invoices ADD CONSTRAINT chk_platform_invoices_source
  CHECK (source IN ('upload', 'pa_reception'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_invoices_pa_external
  ON public.platform_invoices (pa_provider, pa_external_id)
  WHERE pa_external_id IS NOT NULL;

-- ── Lignes extraites (OCR / PA) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_invoice_extracted_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_invoice_id uuid NOT NULL REFERENCES public.platform_invoices(id) ON DELETE CASCADE,
  sort_order          int NOT NULL DEFAULT 0,
  label               text NOT NULL,
  quantity            numeric,
  unit                text,
  unit_price          numeric,
  line_total          numeric,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_invoice_lines_invoice
  ON public.platform_invoice_extracted_lines (platform_invoice_id, sort_order);

ALTER TABLE public.platform_invoice_extracted_lines ENABLE ROW LEVEL SECURITY;

-- ── Clients Ubion (factures émises) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text,
  siret       text,
  vat_number  text,
  address     text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_customers_name CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_customers_company
  ON public.platform_customers (company_id, name);

ALTER TABLE public.platform_customers ENABLE ROW LEVEL SECURITY;

-- ── Factures émises par Ubion ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_emitted_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES public.platform_customers(id) ON DELETE SET NULL,
  customer_name   text,
  invoice_number  text,
  invoice_date    date,
  due_date        date,
  amount_ht       numeric,
  amount_ttc      numeric,
  description     text,
  status          text NOT NULL DEFAULT 'draft',
  source          text NOT NULL DEFAULT 'manual',
  pa_provider     text,
  pa_external_id  text,
  pa_lifecycle_status text,
  pa_raw_payload  jsonb,
  file_path       text,
  file_name       text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_emitted_status CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
  CONSTRAINT chk_platform_emitted_source CHECK (source IN ('manual', 'pa_emission'))
);

CREATE INDEX IF NOT EXISTS idx_platform_emitted_company
  ON public.platform_emitted_invoices (company_id, invoice_date DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_emitted_pa_external
  ON public.platform_emitted_invoices (pa_provider, pa_external_id)
  WHERE pa_external_id IS NOT NULL;

ALTER TABLE public.platform_emitted_invoices ENABLE ROW LEVEL SECURITY;

-- ── Contrats (RH interne Ubion) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_contracts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.platform_companies(id) ON DELETE CASCADE,
  contract_kind       text NOT NULL DEFAULT 'cdi',
  employee_first_name text NOT NULL,
  employee_last_name  text NOT NULL,
  title               text,
  draft_json          jsonb NOT NULL DEFAULT '{}',
  status              text NOT NULL DEFAULT 'draft',
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_contracts_status CHECK (status IN ('draft', 'exported', 'signed')),
  CONSTRAINT chk_platform_contracts_kind CHECK (contract_kind IN ('cdi', 'cdd', 'alternance', 'freelance', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_platform_contracts_company
  ON public.platform_contracts (company_id, created_at DESC);

ALTER TABLE public.platform_contracts ENABLE ROW LEVEL SECURITY;
