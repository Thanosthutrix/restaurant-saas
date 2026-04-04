-- Prix d’achat de référence saisi sur la fiche composant (€ HT / unité de stock), optionnel.
alter table public.inventory_items
  add column if not exists reference_purchase_unit_cost_ht numeric;

comment on column public.inventory_items.reference_purchase_unit_cost_ht is
  'Prix d’achat manuel de référence (€ HT par unité de stock). Repli à la réception si aucune autre source (facture, BL, dernier achat enregistré).';
