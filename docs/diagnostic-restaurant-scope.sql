-- Diagnostic scope restaurant
-- À exécuter dans le SQL Editor Supabase (ou psql) pour vérifier :
-- 1) le restaurant du compte connecté (owner_id = auth.uid())
-- 2) les restaurant_id présents dans dishes
-- 3) le nombre de plats par restaurant_id

-- 1) Restaurant(s) du compte connecté (en tant qu'owner)
-- En SQL Editor Supabase, auth.uid() est celui de l'utilisateur dont le JWT est utilisé.
SELECT id AS restaurant_id, name, owner_id
FROM restaurants
WHERE owner_id = auth.uid();

-- 2) Tous les restaurant_id distincts dans dishes
SELECT restaurant_id, count(*) AS nb_plats
FROM dishes
GROUP BY restaurant_id
ORDER BY nb_plats DESC;

-- 3) Détail : plats par restaurant (avec nom du restaurant si présent)
SELECT r.id AS restaurant_id, r.name AS restaurant_name, count(d.id) AS nb_plats
FROM restaurants r
LEFT JOIN dishes d ON d.restaurant_id = r.id
GROUP BY r.id, r.name
ORDER BY nb_plats DESC;

-- 4) Ancien ID legacy (si tu as utilisé la constante RESTAURANT_ID en dur)
-- Si des plats ont ce restaurant_id alors que ton compte a un autre restaurant, c'est l'origine de l'incohérence.
SELECT 'Legacy RESTAURANT_ID' AS source, count(*) AS nb_plats
FROM dishes
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'
UNION ALL
SELECT 'Restaurant du user (auth.uid())' AS source, count(*) AS nb_plats
FROM dishes d
JOIN restaurants r ON r.id = d.restaurant_id AND r.owner_id = auth.uid();

-- 5) [OPTIONNEL] Rattacher les plats créés avec l'ancien ID au restaurant du user
-- À exécuter UNIQUEMENT si tu veux réattribuer les plats du legacy au restaurant connecté.
-- Remplace <TON_RESTAURANT_ID> par l'id retourné en (1), ou utilise une sous-requête :
/*
UPDATE dishes
SET restaurant_id = (SELECT id FROM restaurants WHERE owner_id = auth.uid() LIMIT 1)
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111';
*/
-- Faire de même pour inventory_items, ticket_imports, services, etc. si besoin.
