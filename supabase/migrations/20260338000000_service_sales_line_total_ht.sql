-- CA HT réel optionnel par ligne agrégée (service × plat), pour marge réalisée quand le ticket donne un montant.
alter table public.service_sales
  add column if not exists line_total_ht numeric;

comment on column public.service_sales.line_total_ht is
  'Total € HT pour cette ligne de vente (qté × prix réel ticket). Si null, l’outil marges utilise qty × dishes.selling_price_ht.';
