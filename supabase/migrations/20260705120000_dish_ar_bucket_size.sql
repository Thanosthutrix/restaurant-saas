-- Limite d’upload du bucket dish-ar (50 Mo = plafond Supabase Free).
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'dish-ar';
