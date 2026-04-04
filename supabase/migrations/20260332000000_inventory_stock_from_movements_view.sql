-- Couche 2 : stock théorique = somme des mouvements (par restaurant + article).
-- La colonne inventory_items.current_stock_qty reste la référence opérationnelle jusqu’à convergence.

CREATE OR REPLACE VIEW inventory_stock_from_movements AS
SELECT
  restaurant_id,
  inventory_item_id,
  COALESCE(SUM(quantity), 0)::numeric AS qty_calculated
FROM stock_movements
GROUP BY restaurant_id, inventory_item_id;

COMMENT ON VIEW inventory_stock_from_movements IS 'Stock calculé exclusivement depuis stock_movements. Les écarts vs current_stock_qty indiquent des flux non encore journalisés (ex. consommation service, saisie manuelle).';
