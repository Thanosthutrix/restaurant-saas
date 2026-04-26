CREATE INDEX IF NOT EXISTS idx_services_restaurant_service_date_id
  ON public.services (restaurant_id, service_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_service_sales_service
  ON public.service_sales (service_id);

CREATE INDEX IF NOT EXISTS idx_dish_components_restaurant_dish
  ON public.dish_components (restaurant_id, dish_id);

CREATE INDEX IF NOT EXISTS idx_inventory_item_components_restaurant_parent
  ON public.inventory_item_components (restaurant_id, parent_item_id);
