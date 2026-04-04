/**
 * Enregistre les lignes service_sales puis applique la consommation stock + stock_impact_json.
 * Factorisé pour nouveau service (ticket) et commande salle encaissée.
 */

import { getCurrentUser } from "@/lib/auth";
import { createServiceSales, updateServiceStockImpact } from "@/lib/db";
import { applyConsumptionToStock } from "@/lib/recipes/applyConsumptionToStock";
import { computeSalesConsumption } from "@/lib/recipes/computeSalesConsumption";
import { serviceConsumptionReferenceLabel } from "@/lib/stock/fifo";

export async function recordServiceSalesAndApplyStock(params: {
  serviceId: string;
  restaurantId: string;
  sales: { dish_id: string; qty: number }[];
}): Promise<{ error: Error | null }> {
  const { serviceId, restaurantId, sales } = params;

  const { error: salesError } = await createServiceSales(serviceId, restaurantId, sales);
  if (salesError) return { error: salesError };

  const saleInputs = sales.filter((s) => s.qty > 0);
  const consumptionResult = await computeSalesConsumption(restaurantId, saleInputs);

  const saleDishIds = new Set(saleInputs.map((s) => s.dish_id));
  const skippedDishIds = new Set(
    consumptionResult.warnings
      .filter((w) => w.dish_id && (w.type === "missing_recipe" || w.type === "draft_recipe"))
      .map((w) => w.dish_id!)
  );
  const appliedCount = [...saleDishIds].filter((id) => !skippedDishIds.has(id)).length;
  const skippedCount = [...saleDishIds].filter((id) => skippedDishIds.has(id)).length;

  if (consumptionResult.consumption.length > 0) {
    const user = await getCurrentUser();
    const applyResult = await applyConsumptionToStock(restaurantId, consumptionResult.consumption, {
      referenceLabel: serviceConsumptionReferenceLabel(serviceId),
      createdBy: user?.id ?? null,
    });
    if (applyResult.error) return { error: applyResult.error };
  }

  const stockImpact = {
    applied_count: appliedCount,
    skipped_count: skippedCount,
    warnings: consumptionResult.warnings.map((w) => ({
      type: w.type,
      dish_id: w.dish_id,
      item_id: w.item_id,
      message: w.message,
    })),
  };
  const impactErr = await updateServiceStockImpact(serviceId, stockImpact);
  if (impactErr.error) return { error: impactErr.error };

  return { error: null };
}
