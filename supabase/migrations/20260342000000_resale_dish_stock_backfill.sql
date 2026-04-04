-- Plats déjà en revente sans lien stock : article revente + dish_components (qty 1) + recette validée.

INSERT INTO inventory_items (restaurant_id, name, unit, item_type, recipe_status, current_stock_qty)
SELECT d.restaurant_id, trim(d.name), 'unit', 'resale', 'missing', 0
FROM dishes d
WHERE d.production_mode = 'resale'
  AND NOT EXISTS (
    SELECT 1
    FROM inventory_items i
    WHERE i.restaurant_id = d.restaurant_id
      AND lower(trim(i.name)) = lower(trim(d.name))
  );

INSERT INTO dish_components (restaurant_id, dish_id, inventory_item_id, qty)
SELECT d.restaurant_id, d.id, i.id, 1
FROM dishes d
INNER JOIN inventory_items i ON i.restaurant_id = d.restaurant_id
  AND lower(trim(i.name)) = lower(trim(d.name))
  AND i.item_type = 'resale'
WHERE d.production_mode = 'resale'
  AND NOT EXISTS (SELECT 1 FROM dish_components dc WHERE dc.dish_id = d.id);

UPDATE dishes d
SET recipe_status = 'validated'
WHERE d.production_mode = 'resale'
  AND EXISTS (SELECT 1 FROM dish_components dc WHERE dc.dish_id = d.id);
