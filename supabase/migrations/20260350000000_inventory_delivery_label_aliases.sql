-- Libellés BL / facture mémorisés → article stock (par restaurant et fournisseur).

CREATE TABLE IF NOT EXISTS public.inventory_delivery_label_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  label_normalized text NOT NULL,
  label_core text NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_delivery_label_aliases_rest_supplier_core
    UNIQUE (restaurant_id, supplier_id, label_core)
);

CREATE INDEX IF NOT EXISTS idx_inventory_delivery_label_aliases_rest_supplier
  ON public.inventory_delivery_label_aliases (restaurant_id, supplier_id);

COMMENT ON TABLE public.inventory_delivery_label_aliases IS
  'Liaison confirmée libellé BL (normalisé) / cœur de libellé → inventory_item. Un cœur par fournisseur (dernier choix gagne).';

COMMENT ON COLUMN public.inventory_delivery_label_aliases.label_normalized IS
  'Dernier libellé complet BL normalisé (affichage / traçabilité).';

COMMENT ON COLUMN public.inventory_delivery_label_aliases.label_core IS
  'Libellé sans bruit packaging / codes (clé de rapprochement).';
