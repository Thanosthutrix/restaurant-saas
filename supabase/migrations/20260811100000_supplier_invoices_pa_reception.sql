-- Réception de factures fournisseurs via une Plateforme Agréée (PA, ex-PDP).
--
-- Contexte : la réforme de facturation électronique impose la capacité à recevoir des
-- factures fournisseurs électroniques (Factur-X / UBL / CII) dès le 1er septembre 2026.
-- L'app se raccorde à une PA existante (marque grise), qui livre les factures par webhook.
--
-- Choix de conception : le format exact des webhooks du prestataire n'est pas encore connu
-- (compte sandbox en cours d'ouverture). Chaque appel webhook est donc stocké intégralement
-- et tel quel dans pa_webhook_events AVANT toute tentative d'interprétation : aucun événement
-- n'est perdu même si le mapping des champs doit être corrigé après coup. Voir
-- lib/pa/webhookHandler.ts pour le point unique où ce mapping sera complété.

-- ── Identification fiable du restaurant destinataire (recherche par SIRET) ─────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurants_siret
  ON public.restaurants (siret)
  WHERE siret IS NOT NULL AND length(trim(siret)) > 0;

-- ── Statut de raccordement PA par restaurant ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_pa_connections (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'super_pdp',
  -- Identifiant interne attribué par la PA pour ce SIRET, une fois l'enrôlement fait côté prestataire.
  provider_company_id text,
  enrollment_status text NOT NULL DEFAULT 'not_enrolled',
  last_invoice_received_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_pa_connections_provider CHECK (provider IN ('super_pdp', 'iopole')),
  CONSTRAINT chk_restaurant_pa_connections_status CHECK (
    enrollment_status IN ('not_enrolled', 'pending', 'active', 'error')
  )
);

COMMENT ON TABLE public.restaurant_pa_connections IS
  'Un compte éditeur (marque grise) sert tous les restaurants ; cette table suit quel restaurant est enrôlé chez quelle PA, pas des identifiants de connexion (le secret webhook est un secret applicatif unique, en variable d''environnement).';

CREATE OR REPLACE FUNCTION public.touch_restaurant_pa_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurant_pa_connections_updated ON public.restaurant_pa_connections;
CREATE TRIGGER trg_restaurant_pa_connections_updated
  BEFORE UPDATE ON public.restaurant_pa_connections
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_restaurant_pa_connections_updated_at();

ALTER TABLE public.restaurant_pa_connections ENABLE ROW LEVEL SECURITY;

-- ── Journal brut des webhooks reçus (source de vérité, indépendante du mapping) ────────────
CREATE TABLE IF NOT EXISTS public.pa_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  signature_valid boolean NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}',
  raw_payload jsonb NOT NULL,
  matched_restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  matched_supplier_invoice_id uuid,
  processing_status text NOT NULL DEFAULT 'received',
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_pa_webhook_events_status CHECK (
    processing_status IN ('received', 'unmapped', 'matched', 'unmatched_restaurant', 'error')
  )
);

CREATE INDEX IF NOT EXISTS idx_pa_webhook_events_restaurant
  ON public.pa_webhook_events (matched_restaurant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_webhook_events_status
  ON public.pa_webhook_events (processing_status, received_at DESC);

COMMENT ON TABLE public.pa_webhook_events IS
  'Copie brute de chaque appel webhook PA, avant toute interprétation. processing_status = unmapped tant que lib/pa/webhookHandler.ts n''a pas été complété avec le format réel du prestataire.';

ALTER TABLE public.pa_webhook_events ENABLE ROW LEVEL SECURITY;

-- ── Rattachement des factures reçues par PA à supplier_invoices ────────────────────────────
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS pa_provider text,
  ADD COLUMN IF NOT EXISTS pa_external_id text,
  ADD COLUMN IF NOT EXISTS pa_format text,
  -- Vocabulaire de statut du prestataire non normalisé volontairement (texte libre) : la
  -- nomenclature exacte du cycle de vie (déposée/rejetée/approuvée/…) n'est pas encore connue.
  ADD COLUMN IF NOT EXISTS pa_lifecycle_status text,
  ADD COLUMN IF NOT EXISTS pa_webhook_event_id uuid REFERENCES public.pa_webhook_events(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS chk_supplier_invoices_source;
ALTER TABLE public.supplier_invoices ADD CONSTRAINT chk_supplier_invoices_source
  CHECK (source IN ('upload', 'pa_reception'));

ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS chk_supplier_invoices_pa_format;
ALTER TABLE public.supplier_invoices ADD CONSTRAINT chk_supplier_invoices_pa_format
  CHECK (pa_format IS NULL OR pa_format IN ('facturx', 'ubl', 'cii'));

-- Idempotence : une relivraison webhook (retry réseau) ne doit pas créer un doublon.
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invoices_pa_external
  ON public.supplier_invoices (pa_provider, pa_external_id)
  WHERE pa_provider IS NOT NULL AND pa_external_id IS NOT NULL;

COMMENT ON COLUMN public.supplier_invoices.source IS
  'upload = déposée manuellement (OCR) ; pa_reception = reçue automatiquement via la Plateforme Agréée.';
