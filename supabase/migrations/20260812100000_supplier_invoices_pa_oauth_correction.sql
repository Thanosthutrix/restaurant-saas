-- Correction du modèle de réception PA : la vraie spec (OpenAPI Super PDP, lue le 12/08)
-- montre un modèle OAuth 2.1 (Authorization Code par restaurant) + lecture par sondage
-- (GET /invoices?direction=in), et NON des webhooks poussés par le prestataire.
--
-- Annule la migration 20260811100000 sur ce point : pa_webhook_events et la colonne
-- pa_webhook_event_id supposaient un mécanisme qui n'existe pas dans cette API.

-- La colonne référence la table : la retirer d'abord, sinon DROP TABLE échoue (2BP01).
ALTER TABLE public.supplier_invoices
  DROP COLUMN IF EXISTS pa_webhook_event_id;

DROP TABLE IF EXISTS public.pa_webhook_events;

-- ── Connexion OAuth par restaurant ──────────────────────────────────────────────────────────
-- Un compte éditeur (une seule Application OAuth Super PDP) sert tous les restaurants ;
-- chaque restaurant délègue l'accès à SA société via Authorization Code (company_verification_status
-- confirme l'autorisation légale côté Super PDP — KYB).
ALTER TABLE public.restaurant_pa_connections
  ADD COLUMN IF NOT EXISTS company_number text,
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_verification_status text;

COMMENT ON COLUMN public.restaurant_pa_connections.provider_company_id IS
  'Id interne Super PDP (entier, endpoint /companies) — clé de rattachement des factures reçues via invoice.company_id. PAS le SIREN.';
COMMENT ON COLUMN public.restaurant_pa_connections.company_number IS
  'SIREN (9 chiffres) affiché à l''utilisateur — donnée de confort, pas la clé de matching.';

ALTER TABLE public.restaurant_pa_connections DROP CONSTRAINT IF EXISTS chk_restaurant_pa_connections_kyb_status;
ALTER TABLE public.restaurant_pa_connections ADD CONSTRAINT chk_restaurant_pa_connections_kyb_status
  CHECK (company_verification_status IS NULL OR company_verification_status IN ('verified', 'needs_review', 'failed'));

-- ── Factures reçues par sondage ─────────────────────────────────────────────────────────────
-- L'id de facture Super PDP est un entier (schéma `invoice.id`) : on le stocke tel quel dans
-- pa_external_id (texte) pour rester compatible si un futur prestataire utilise un id non numérique.
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS pa_raw_payload jsonb;

COMMENT ON COLUMN public.supplier_invoices.pa_raw_payload IS
  'Copie brute de l''invoice_overview renvoyé par GET /invoices — inclut events[] (cycle de vie complet, pas seulement le dernier statut) et en_invoice (EN 16931). Source de vérité si le mapping doit être corrigé après coup.';
COMMENT ON COLUMN public.supplier_invoices.pa_lifecycle_status IS
  'Dernier status_code connu (ex. fr:205 = accepted, api:received…) — liste complète dans la spec Super PDP, non contrainte en base car propre à chaque prestataire.';
