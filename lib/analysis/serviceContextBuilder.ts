/**
 * Agrège les données POS / service du jour pour alimenter le moteur de questions.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import type { ServiceContext, ServiceDaySaleRow } from "@/lib/analysis/types";

const AVG_LOOKBACK_DAYS = 28;
const NEW_DISH_DAYS_MAX = 7;
const HIGH_INGREDIENT_TOP_N = 3;

export async function buildServiceContext(
  restaurantId: string,
  serviceId: string
): Promise<ServiceContext | null> {
  const { data: service, error: svcErr } = await supabaseServer
    .from("services")
    .select("id, service_date, service_type, restaurant_id")
    .eq("id", serviceId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (svcErr || !service) return null;

  const serviceDate = String((service as { service_date: string }).service_date);
  const serviceType = String((service as { service_type: string }).service_type);

  const [salesRows, avgQty, dishes, categories, ingredientUsage] = await Promise.all([
    fetchServiceSales(serviceId),
    fetchAvgSalesQty(restaurantId, serviceType, serviceDate),
    fetchMenuDishes(restaurantId),
    fetchIngredientFamilies(restaurantId),
    fetchHighUsageIngredients(restaurantId, serviceId),
  ]);

  const totalSalesQty = salesRows.reduce((s, r) => s + r.qty, 0);
  const totalRevenueHt = salesRows.reduce((s, r) => s + (r.line_total_ht ?? 0), 0);

  const sorted = [...salesRows].sort((a, b) => b.qty - a.qty);
  const topSeller = sorted[0]?.qty > 0 ? sorted[0] : null;

  const slowCandidates = sorted.filter((r) => r.qty > 0);
  const slowSeller =
    slowCandidates.length > 1 ? slowCandidates[slowCandidates.length - 1] : slowCandidates[0] ?? null;

  const salesVsAvgPct =
    avgQty != null && avgQty > 0
      ? Math.round(((totalSalesQty - avgQty) / avgQty) * 1000) / 10
      : null;

  const newDishes = await fetchNewDishes(restaurantId, NEW_DISH_DAYS_MAX);

  return {
    restaurantId,
    serviceId,
    serviceDate,
    serviceType,
    totalCovers: totalSalesQty,
    totalSalesQty,
    totalRevenueHt,
    salesByDish: salesRows,
    topSeller,
    slowSeller: slowSeller && topSeller && slowSeller.dish_id !== topSeller.dish_id ? slowSeller : null,
    salesVsAvgPct,
    newDishes,
    highUsageIngredients: ingredientUsage,
    menuDishes: dishes,
    ingredientFamilies: categories,
  };
}

async function fetchServiceSales(serviceId: string): Promise<ServiceDaySaleRow[]> {
  const { data, error } = await supabaseServer
    .from("service_sales")
    .select("dish_id, qty, line_total_ht, dishes(name, created_at)")
    .eq("service_id", serviceId);

  if (error || !data) return [];

  return data.map((row) => {
    const dishRaw = row.dishes as unknown;
    const dish = (Array.isArray(dishRaw) ? dishRaw[0] : dishRaw) as {
      name: string;
      created_at: string | null;
    } | null;
    return {
      dish_id: String(row.dish_id),
      dish_name: dish?.name ?? "Plat",
      qty: Number(row.qty),
      line_total_ht: row.line_total_ht != null ? Number(row.line_total_ht) : null,
      created_at: dish?.created_at ?? null,
    };
  });
}

async function fetchAvgSalesQty(
  restaurantId: string,
  serviceType: string,
  excludeDate: string
): Promise<number | null> {
  const fromDate = shiftDate(excludeDate, -AVG_LOOKBACK_DAYS);

  const { data: services, error: svcErr } = await supabaseServer
    .from("services")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("service_type", serviceType)
    .gte("service_date", fromDate)
    .lt("service_date", excludeDate);

  if (svcErr || !services?.length) return null;

  const serviceIds = services.map((s) => s.id as string);
  const { data: sales, error: salesErr } = await supabaseServer
    .from("service_sales")
    .select("qty")
    .in("service_id", serviceIds);

  if (salesErr || !sales?.length) return null;

  const total = sales.reduce((s, r) => s + Number(r.qty), 0);
  return total / serviceIds.length;
}

async function fetchMenuDishes(
  restaurantId: string
): Promise<{ dish_id: string; dish_name: string; image_url: string | null }[]> {
  const { data, error } = await supabaseServer
    .from("dishes")
    .select("id, name, image_url, model_3d_source_image_url")
    .eq("restaurant_id", restaurantId)
    .order("name");

  if (error || !data) return [];

  return data.map((d) => ({
    dish_id: String(d.id),
    dish_name: String(d.name),
    image_url:
      d.image_url != null
        ? String(d.image_url)
        : d.model_3d_source_image_url != null
          ? String(d.model_3d_source_image_url)
          : null,
  }));
}

async function fetchIngredientFamilies(
  restaurantId: string
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_categories")
    .select("id, name")
    .eq("restaurant_id", restaurantId)
    .in("applies_to", ["inventory", "both"])
    .order("name");

  if (error || !data) return [];

  return data.map((c) => ({ id: String(c.id), name: String(c.name) }));
}

async function fetchNewDishes(
  restaurantId: string,
  maxDays: number
): Promise<{ dish_id: string; dish_name: string; days_since_added: number }[]> {
  const cutoff = shiftDate(new Date().toISOString().slice(0, 10), -maxDays);

  const { data, error } = await supabaseServer
    .from("dishes")
    .select("id, name, created_at")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", `${cutoff}T00:00:00Z`);

  if (error || !data) return [];

  const now = Date.now();
  return data.map((d) => {
    const created = new Date(String(d.created_at)).getTime();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return {
      dish_id: String(d.id),
      dish_name: String(d.name),
      days_since_added: days,
    };
  });
}

async function fetchHighUsageIngredients(
  restaurantId: string,
  serviceId: string
): Promise<
  {
    inventory_item_id: string;
    ingredient_name: string;
    consumed_qty: number;
    food_cost_ht: number;
  }[]
> {
  const label = `Service ${serviceId}`;
  const { data: movements, error: movErr } = await supabaseServer
    .from("stock_movements")
    .select("inventory_item_id, quantity, unit_cost, inventory_items(name)")
    .eq("restaurant_id", restaurantId)
    .eq("movement_type", "consumption")
    .eq("reference_label", label);

  if (movErr || !movements?.length) return [];

  const byItem = new Map<
    string,
    { name: string; qty: number; cost: number }
  >();

  for (const m of movements) {
    const itemId = String(m.inventory_item_id);
    const itemRaw = m.inventory_items as unknown;
    const item = (Array.isArray(itemRaw) ? itemRaw[0] : itemRaw) as { name: string } | null;
    const qty = Math.abs(Number(m.quantity));
    const unitCost = m.unit_cost != null ? Number(m.unit_cost) : 0;
    const prev = byItem.get(itemId) ?? { name: item?.name ?? "Ingrédient", qty: 0, cost: 0 };
    prev.qty += qty;
    prev.cost += qty * unitCost;
    byItem.set(itemId, prev);
  }

  return [...byItem.entries()]
    .map(([inventory_item_id, v]) => ({
      inventory_item_id,
      ingredient_name: v.name,
      consumed_qty: v.qty,
      food_cost_ht: Math.round(v.cost * 100) / 100,
    }))
    .sort((a, b) => b.food_cost_ht - a.food_cost_ht)
    .slice(0, HIGH_INGREDIENT_TOP_N);
}

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
