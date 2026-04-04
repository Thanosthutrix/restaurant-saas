/**
 * État théorique après service : ventes + consommation théorique.
 * Utilisé par la page /service/[id]/stock.
 * Ne calcule pas le stock restant ; affiche la consommation théorique et les alertes.
 */

import { getService, getServiceSalesWithDishes, getDishes } from "@/lib/db";
import type { Service, ServiceSaleWithDish, Dish } from "@/lib/db";
import { computeSalesConsumption } from "@/lib/recipes/computeSalesConsumption";
import type { ComputeSalesConsumptionResult } from "@/lib/recipes/computeSalesConsumption";

export type ServiceTheoreticalState = {
  service: Service;
  sales: ServiceSaleWithDish[];
  consumptionResult: ComputeSalesConsumptionResult;
  /** Plats vendus (pour alertes recette draft / manquante). */
  soldDishes: Dish[];
};

/**
 * Charge le service, les ventes, et calcule la consommation théorique.
 * Les plats vendus sont rechargés pour avoir recipe_status (alertes draft / missing).
 */
export async function getServiceTheoreticalState(
  serviceId: string
): Promise<{ data: ServiceTheoreticalState | null; error: Error | null }> {
  const serviceRes = await getService(serviceId);
  if (serviceRes.error || !serviceRes.data) {
    return { data: null, error: serviceRes.error ?? new Error("Service introuvable.") };
  }
  const service = serviceRes.data;
  const restaurantId = service.restaurant_id;

  const [salesRes, dishesRes] = await Promise.all([
    getServiceSalesWithDishes(serviceId),
    getDishes(restaurantId),
  ]);

  const sales = salesRes.data ?? [];
  if (salesRes.error) return { data: null, error: salesRes.error };

  const allDishes = dishesRes.data ?? [];
  const dishIds = new Set(sales.map((s) => s.dish_id));
  const soldDishes = allDishes.filter((d) => dishIds.has(d.id));

  const saleInputs = sales.map((s) => ({ dish_id: s.dish_id, qty: s.qty }));
  const consumptionResult = await computeSalesConsumption(restaurantId, saleInputs);

  return {
    data: {
      service,
      sales,
      consumptionResult,
      soldDishes,
    },
    error: null,
  };
}
