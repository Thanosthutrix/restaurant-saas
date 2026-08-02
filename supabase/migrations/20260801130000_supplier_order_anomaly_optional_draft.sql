-- Anomalies commande : autoriser enregistrement depuis suggestions (sans brouillon).
ALTER TABLE supplier_order_anomaly_responses
  ALTER COLUMN order_draft_id DROP NOT NULL,
  ALTER COLUMN order_draft_line_id DROP NOT NULL;

ALTER TABLE supplier_order_anomaly_responses
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'order_draft';

COMMENT ON COLUMN supplier_order_anomaly_responses.source IS
  'order_draft = ajustement brouillon ; suggestion = ajustement avant création commande.';
