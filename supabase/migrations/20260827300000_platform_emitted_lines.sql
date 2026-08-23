-- Lignes des factures émises Ubion (brouillons avant envoi PA)

CREATE TABLE IF NOT EXISTS public.platform_emitted_invoice_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emitted_invoice_id  uuid NOT NULL REFERENCES public.platform_emitted_invoices(id) ON DELETE CASCADE,
  sort_order          int NOT NULL DEFAULT 0,
  label               text NOT NULL,
  quantity            numeric NOT NULL DEFAULT 1,
  unit                text NOT NULL DEFAULT 'C62',
  unit_price          numeric NOT NULL,
  vat_rate            numeric NOT NULL DEFAULT 20,
  line_total          numeric NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_emitted_line_label CHECK (length(trim(label)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_emitted_lines_invoice
  ON public.platform_emitted_invoice_lines (emitted_invoice_id, sort_order);

ALTER TABLE public.platform_emitted_invoice_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_pa_connections
  ADD COLUMN IF NOT EXISTS last_invoice_emitted_at timestamptz;
