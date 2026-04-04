-- Prix carte en TTC + taux TVA par plat ; HT dérivé pour coûts / marges (cohérent avec l’affichage carte France).

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS selling_price_ttc numeric,
  ADD COLUMN IF NOT EXISTS selling_vat_rate_pct numeric NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.dishes.selling_price_ttc IS
  'Prix de vente TTC affiché carte client (€ / portion).';
COMMENT ON COLUMN public.dishes.selling_vat_rate_pct IS
  'Taux TVA français en % (ex. 5.5, 10, 20) pour déduire le HT : HT = TTC / (1 + taux/100).';

ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS chk_dishes_selling_vat_rate_pct;
ALTER TABLE public.dishes ADD CONSTRAINT chk_dishes_selling_vat_rate_pct
  CHECK (selling_vat_rate_pct IS NULL OR (selling_vat_rate_pct >= 0 AND selling_vat_rate_pct <= 100));

-- Ancien modèle : selling_price_ht = prix HT. On en déduit un TTC cohérent avec le taux (défaut 10 %).
UPDATE public.dishes
SET selling_price_ttc = round(selling_price_ht * (1 + selling_vat_rate_pct / 100.0), 2)
WHERE selling_price_ht IS NOT NULL
  AND selling_price_ttc IS NULL;

-- HT stocké = déduit du TTC (marges, coûts matière restent en HT).
UPDATE public.dishes
SET selling_price_ht = round(selling_price_ttc / (1 + selling_vat_rate_pct / 100.0), 2)
WHERE selling_price_ttc IS NOT NULL
  AND selling_vat_rate_pct IS NOT NULL
  AND selling_vat_rate_pct >= 0;
