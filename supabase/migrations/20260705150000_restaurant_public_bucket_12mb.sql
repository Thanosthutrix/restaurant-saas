-- Limite d'upload bucket restaurant-public : 12 Mo.
UPDATE storage.buckets
SET file_size_limit = 12582912
WHERE id = 'restaurant-public';
