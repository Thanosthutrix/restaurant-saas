-- Tickets comptoir / vente directe : commande sans table, libellé affiché (nom client, etc.).

ALTER TABLE public.dining_orders
  ADD COLUMN IF NOT EXISTS counter_ticket_label text;

ALTER TABLE public.dining_orders
  ALTER COLUMN dining_table_id DROP NOT NULL;

ALTER TABLE public.dining_orders
  DROP CONSTRAINT IF EXISTS chk_dining_orders_table_or_counter;

ALTER TABLE public.dining_orders
  ADD CONSTRAINT chk_dining_orders_table_or_counter CHECK (
    (dining_table_id IS NOT NULL AND counter_ticket_label IS NULL)
    OR
    (
      dining_table_id IS NULL
      AND counter_ticket_label IS NOT NULL
      AND length(btrim(counter_ticket_label)) > 0
    )
  );

COMMENT ON COLUMN public.dining_orders.counter_ticket_label IS 'Si non null : ticket comptoir (pas de table). Sinon commande liée à dining_table_id.';
