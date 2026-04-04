-- Prix de vente catalogue (€ HT / portion ou unité vendue) pour analyse de marge vs coût matière.
alter table public.dishes
  add column if not exists selling_price_ht numeric;

comment on column public.dishes.selling_price_ht is
  'Prix de vente HT par unité vendue (assimilé à une portion). Utilisé pour marge € et % dans l’outil marges.';
