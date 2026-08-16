-- Correction d'écart de schéma : suppliers.email porte une contrainte NOT NULL en base
-- réelle qu'aucune migration ne documente, alors que tout le code applicatif (createSupplier,
-- resolveOrCreateSupplierFromInvoiceVendor) traite ce champ comme optionnel depuis toujours
-- (`payload.email?.trim() || null`). Découvert en production : la création d'un fournisseur
-- sans email échouait avec « null value in column "email" violates not-null constraint »,
-- notamment pour les factures reçues via une Plateforme Agréée dont le vendeur ne renseigne
-- pas toujours de contact e-mail (champ optionnel dans le schéma EN 16931).

ALTER TABLE public.suppliers ALTER COLUMN email DROP NOT NULL;
