-- Conversion BL → stock mémorisée par libellé fournisseur (réutilisable aux imports suivants).

ALTER TABLE public.inventory_delivery_label_aliases
  ADD COLUMN IF NOT EXISTS bl_purchase_unit text,
  ADD COLUMN IF NOT EXISTS stock_units_per_purchase double precision;

COMMENT ON COLUMN public.inventory_delivery_label_aliases.bl_purchase_unit IS
  'Unité d’achat telle que sur le BL (sac, carton…) pour ce libellé fournisseur.';

COMMENT ON COLUMN public.inventory_delivery_label_aliases.stock_units_per_purchase IS
  'Nombre d’unités de stock pour 1 unité livrée BL (ex. 20000 si 1 sac = 20 kg et stock en g).';
