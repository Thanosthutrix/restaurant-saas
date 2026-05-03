/**
 * Analyse ventes × rubriques × marges sur une période (services scannés).
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  categoryPathLabel,
  listRestaurantCategories,
} from "@/lib/catalog/restaurantCategories";
import { getDishes, type RecipeStatus } from "@/lib/db";
import { getRealizedMarginRowsByDish } from "@/lib/margins/realizedDishMargins";
import { fetchServicesInDateRange } from "@/lib/margins/realizedServiceMargins";

/** Max services inclus dans l’agrégat (cohérent avec la charge FIFO / marges). */
export const SALES_INSIGHTS_SERVICE_LIMIT = 400;

export type SalesInsightRow = {
  dishId: string;
  dishName: string;
  categoryId: string | null;
  /** Chemin rubrique ou « Sans rubrique ». */
  categoryPath: string;
  qtySold: number;
  revenueHt: number | null;
  marginHt: number | null;
  marginPct: number | null;
  revenueComplete: boolean;
  note: string | null;
  recipeStatus: RecipeStatus | null;
};

export type SalesInsightSuggestions = {
  /** Marge % élevée + volume significatif : mettre en avant. */
  pushHard: SalesInsightRow[];
  /** Marge faible avec volume : revoir prix ou coût. */
  reviewPricing: SalesInsightRow[];
  /** Recette absente ou brouillon alors qu’il y a des ventes. */
  fixRecipe: SalesInsightRow[];
  /** Forte marge mais peu vendu : opportunité promo / mise en avant. */
  sleeperHits: SalesInsightRow[];
};

export type CategoryAggregate = {
  categoryPath: string;
  qtySold: number;
  revenueHt: number;
  /** Somme des marges HT (uniquement lignes avec marge calculable). */
  marginHtSum: number;
};

type QtyRow = { dish_id: string; qty: unknown };

async function sumQtyByDish(
  restaurantId: string,
  serviceIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (serviceIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from("service_sales")
    .select("dish_id, qty")
    .eq("restaurant_id", restaurantId)
    .in("service_id", serviceIds);

  if (error || !data) return map;
  for (const row of data as QtyRow[]) {
    const id = row.dish_id;
    const q = Number(row.qty);
    if (!Number.isFinite(q) || q <= 0) continue;
    map.set(id, (map.get(id) ?? 0) + q);
  }
  return map;
}

function buildCategoryAggregates(rows: SalesInsightRow[]): CategoryAggregate[] {
  const byPath = new Map<
    string,
    { qtySold: number; revenueHt: number; marginHtSum: number }
  >();
  for (const r of rows) {
    const cur = byPath.get(r.categoryPath) ?? {
      qtySold: 0,
      revenueHt: 0,
      marginHtSum: 0,
    };
    cur.qtySold += r.qtySold;
    if (r.revenueHt != null && Number.isFinite(r.revenueHt)) {
      cur.revenueHt += r.revenueHt;
    }
    if (r.marginHt != null && Number.isFinite(r.marginHt)) {
      cur.marginHtSum += r.marginHt;
    }
    byPath.set(r.categoryPath, cur);
  }
  return [...byPath.entries()]
    .map(([categoryPath, v]) => ({
      categoryPath,
      qtySold: v.qtySold,
      revenueHt: v.revenueHt,
      marginHtSum: v.marginHtSum,
    }))
    .sort((a, b) => b.revenueHt - a.revenueHt);
}

/** Seuils indicatifs pour suggestions (pas des règles métier figées). */
const PUSH_MARGIN_PCT = 68;
const PUSH_MIN_QTY = 6;
const REVIEW_MARGIN_PCT = 52;
const REVIEW_MIN_REVENUE_HT = 120;
const SLEEPER_MARGIN_PCT = 65;
const SLEEPER_MAX_QTY = 14;
const SLEEPER_MIN_QTY = 2;

function buildSuggestions(rows: SalesInsightRow[]): SalesInsightSuggestions {
  const pushHard = rows.filter(
    (r) =>
      r.marginPct != null &&
      r.marginPct >= PUSH_MARGIN_PCT &&
      r.qtySold >= PUSH_MIN_QTY &&
      !r.note?.includes("FIFO partiel")
  );

  const reviewPricing = rows.filter(
    (r) =>
      r.marginPct != null &&
      r.marginPct < REVIEW_MARGIN_PCT &&
      (r.revenueHt ?? 0) >= REVIEW_MIN_REVENUE_HT &&
      r.qtySold >= 5
  );

  const fixRecipe = rows.filter(
    (r) =>
      (r.recipeStatus === "missing" || r.recipeStatus === "draft") && r.qtySold > 0
  );

  const sleeperHits = rows.filter(
    (r) =>
      r.marginPct != null &&
      r.marginPct >= SLEEPER_MARGIN_PCT &&
      r.qtySold >= SLEEPER_MIN_QTY &&
      r.qtySold <= SLEEPER_MAX_QTY &&
      (r.revenueHt ?? 0) > 0
  );

  function sortByRevenue(a: SalesInsightRow, b: SalesInsightRow) {
    return (b.revenueHt ?? 0) - (a.revenueHt ?? 0);
  }

  pushHard.sort(sortByRevenue);
  reviewPricing.sort(sortByRevenue);
  fixRecipe.sort((a, b) => b.qtySold - a.qtySold);
  sleeperHits.sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0));

  return {
    pushHard: pushHard.slice(0, 12),
    reviewPricing: reviewPricing.slice(0, 12),
    fixRecipe: fixRecipe.slice(0, 12),
    sleeperHits: sleeperHits.slice(0, 12),
  };
}

export async function getSalesInsightsData(
  restaurantId: string,
  from: string,
  to: string
): Promise<{
  rows: SalesInsightRow[];
  suggestions: SalesInsightSuggestions;
  categoryAggregates: CategoryAggregate[];
  meta: { serviceCount: number; from: string; to: string };
  error: string | null;
}> {
  const services = await fetchServicesInDateRange(
    restaurantId,
    from,
    to,
    SALES_INSIGHTS_SERVICE_LIMIT
  );
  const serviceIds = services.map((s) => s.id);

  if (serviceIds.length === 0) {
    return {
      rows: [],
      suggestions: {
        pushHard: [],
        reviewPricing: [],
        fixRecipe: [],
        sleeperHits: [],
      },
      categoryAggregates: [],
      meta: { serviceCount: 0, from, to },
      error: null,
    };
  }

  const [marginRows, categoriesRes, dishesRes, qtyByDish] = await Promise.all([
    getRealizedMarginRowsByDish(restaurantId, serviceIds),
    listRestaurantCategories(restaurantId),
    getDishes(restaurantId),
    sumQtyByDish(restaurantId, serviceIds),
  ]);

  const flat = categoriesRes.data ?? [];
  const dishById = new Map((dishesRes.data ?? []).map((d) => [d.id, d]));

  const rows: SalesInsightRow[] = marginRows.map((m) => {
    const d = dishById.get(m.dishId);
    const catId = d?.category_id ?? null;
    const pathLabel = categoryPathLabel(catId, flat);
    return {
      dishId: m.dishId,
      dishName: m.dishName,
      categoryId: catId,
      categoryPath: pathLabel ?? "Sans rubrique",
      qtySold: qtyByDish.get(m.dishId) ?? 0,
      revenueHt: m.revenueHt,
      marginHt: m.marginHt,
      marginPct: m.marginPct,
      revenueComplete: m.revenueComplete,
      note: m.note,
      recipeStatus: d?.recipe_status ?? null,
    };
  });

  const categoryAggregates = buildCategoryAggregates(rows);
  const suggestions = buildSuggestions(rows);

  return {
    rows,
    suggestions,
    categoryAggregates,
    meta: { serviceCount: services.length, from, to },
    error: categoriesRes.error?.message ?? dishesRes.error?.message ?? null,
  };
}
