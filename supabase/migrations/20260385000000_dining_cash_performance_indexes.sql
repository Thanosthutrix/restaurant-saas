CREATE INDEX IF NOT EXISTS idx_dining_order_lines_restaurant_order
  ON public.dining_order_lines (restaurant_id, dining_order_id);

CREATE INDEX IF NOT EXISTS idx_dining_orders_restaurant_status_settled
  ON public.dining_orders (restaurant_id, status, settled_at DESC);

CREATE INDEX IF NOT EXISTS idx_dining_order_payments_restaurant_order
  ON public.dining_order_payments (restaurant_id, dining_order_id);
