/**
 * Calculs déterministes du Rapport d'Analyse Ultime.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import { countAnonymousFeedbackByCategory } from "@/lib/analysis/feedbackDb";
import type {
  DeterministicAnalysisPayload,
  FeedbackSummary,
  FoodCostGap,
  MenuMatrixItem,
  MenuMatrixQuadrant,
  WasteSummary,
} from "@/lib/analysis/reportTypes";
import { getSalesInsightsData, type SalesInsightRow } from "@/lib/insights/salesInsights";
import { computeDishFoodCostHt } from "@/lib/margins/dishMarginAnalysis";
import { roundMoney } from "@/lib/stock/purchasePriceHistory";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function classifyQuadrant(
  qty: number,
  marginPct: number | null,
  medianQty: number,
  medianMargin: number
): MenuMatrixQuadrant {
  const m = marginPct ?? 0;
  const highPop = qty >= medianQty;
  const highMargin = m >= medianMargin;
  if (highPop && highMargin) return "star";
  if (highPop && !highMargin) return "plowhorse";
  if (!highPop && highMargin) return "puzzle";
  return "dog";
}

const QUADRANT_LABELS: Record<MenuMatrixQuadrant, string> = {
  star: "Star",
  plowhorse: "Cheval de trait",
  puzzle: "Énigme",
  dog: "Poids mort",
};

export { QUADRANT_LABELS };

async function buildMenuMatrix(
  restaurantId: string,
  rows: SalesInsightRow[]
): Promise<{ items: MenuMatrixItem[]; medianQty: number; medianMarginPct: number }> {
  const sold = rows.filter((r) => r.qtySold > 0);
  const medianQty = median(sold.map((r) => r.qtySold));
  const margins = sold.map((r) => r.marginPct).filter((m): m is number => m != null && Number.isFinite(m));
  const medianMarginPct = margins.length > 0 ? median(margins) : 50;

  const items: MenuMatrixItem[] = [];
  for (const r of sold) {
    let foodCostPct: number | null = null;
    const fc = await computeDishFoodCostHt(restaurantId, r.dishId);
    if (r.revenueHt != null && r.revenueHt > 0 && fc.costIsComplete) {
      foodCostPct = Math.round((fc.foodCostHt / r.revenueHt) * 1000) / 10;
    }
    items.push({
      dishId: r.dishId,
      dishName: r.dishName,
      qtySold: r.qtySold,
      revenueHt: r.revenueHt,
      marginPct: r.marginPct,
      foodCostPct,
      quadrant: classifyQuadrant(r.qtySold, r.marginPct, medianQty, medianMarginPct),
    });
  }

  items.sort((a, b) => (b.revenueHt ?? 0) - (a.revenueHt ?? 0));
  return { items, medianQty, medianMarginPct };
}

async function buildWasteSummary(
  restaurantId: string,
  from: string,
  to: string
): Promise<WasteSummary> {
  const { data, error } = await supabaseServer
    .from("waste_logs")
    .select("waste_type, reason, quantity, estimated_cost_ht, inventory_items(name)")
    .eq("restaurant_id", restaurantId)
    .gte("logged_at", `${from}T00:00:00Z`)
    .lte("logged_at", `${to}T23:59:59Z`);

  const summary: WasteSummary = {
    totalCostHt: 0,
    logCount: 0,
    byType: {},
    byReason: {},
    topItems: [],
  };

  if (error || !data) return summary;

  const itemCosts = new Map<string, { name: string; costHt: number; quantity: number }>();

  for (const row of data) {
    summary.logCount += 1;
    const cost = row.estimated_cost_ht != null ? Number(row.estimated_cost_ht) : 0;
    summary.totalCostHt += cost;

    const wt = String(row.waste_type);
    const rs = String(row.reason);
    summary.byType[wt] = summary.byType[wt] ?? { count: 0, costHt: 0 };
    summary.byType[wt].count += 1;
    summary.byType[wt].costHt += cost;

    summary.byReason[rs] = summary.byReason[rs] ?? { count: 0, costHt: 0 };
    summary.byReason[rs].count += 1;
    summary.byReason[rs].costHt += cost;

    const itemRaw = row.inventory_items as unknown;
    const item = (Array.isArray(itemRaw) ? itemRaw[0] : itemRaw) as { name: string } | null;
    const name = item?.name ?? "Article";
    const prev = itemCosts.get(name) ?? { name, costHt: 0, quantity: 0 };
    prev.costHt += cost;
    prev.quantity += Number(row.quantity);
    itemCosts.set(name, prev);
  }

  summary.totalCostHt = roundMoney(summary.totalCostHt);
  summary.topItems = [...itemCosts.values()]
    .sort((a, b) => b.costHt - a.costHt)
    .slice(0, 5);

  return summary;
}

async function buildFeedbackSummary(
  restaurantId: string,
  from: string,
  to: string
): Promise<FeedbackSummary> {
  const { data, error } = await supabaseServer
    .from("anonymous_feedback")
    .select("category, template_key, response_payload")
    .eq("restaurant_id", restaurantId)
    .gte("submitted_at", `${from}T00:00:00Z`)
    .lte("submitted_at", `${to}T23:59:59Z`);

  const summary: FeedbackSummary = {
    totalResponses: 0,
    byCategory: {},
    stressDistribution: { hell: 0, tense: 0, smooth: 0, other: 0 },
    plateReturns: 0,
    bottleneckDishes: [],
    ingredientQualityAlerts: 0,
  };

  if (error || !data) return summary;

  const bottleneckMap = new Map<string, number>();

  for (const row of data) {
    summary.totalResponses += 1;
    const cat = String(row.category);
    summary.byCategory[cat] = (summary.byCategory[cat] ?? 0) + 1;

    const payload = row.response_payload as Record<string, unknown>;
    const key = String(row.template_key);

    if (key === "TEAM_STRESS_EMOJI") {
      const v = String(payload.value ?? "");
      if (v === "hell") summary.stressDistribution.hell += 1;
      else if (v === "tense") summary.stressDistribution.tense += 1;
      else if (v === "smooth") summary.stressDistribution.smooth += 1;
      else summary.stressDistribution.other += 1;
    }

    if (key === "PLATE_RETURN_FREQUENT" && payload.value === true) {
      summary.plateReturns += 1;
      const dishId = payload.dish_id != null ? String(payload.dish_id) : null;
      if (dishId) bottleneckMap.set(dishId, (bottleneckMap.get(dishId) ?? 0) + 1);
    }

    if (key === "KITCHEN_BOTTLENECK_DISH" && payload.dish_id) {
      const dishId = String(payload.dish_id);
      bottleneckMap.set(dishId, (bottleneckMap.get(dishId) ?? 0) + 1);
    }

    if (key === "INGREDIENT_QUALITY_ALERT" && (payload.category_id || payload.value)) {
      summary.ingredientQualityAlerts += 1;
    }
  }

  summary.bottleneckDishes = [...bottleneckMap.entries()]
    .map(([dishId, count]) => ({ dishId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const catCounts = await countAnonymousFeedbackByCategory(restaurantId, from, to);
  for (const [cat, n] of catCounts) {
    summary.byCategory[cat] = n;
  }

  return summary;
}

async function buildFoodCostGap(
  restaurantId: string,
  rows: SalesInsightRow[],
  wasteCostHt: number
): Promise<FoodCostGap> {
  let revenueHt = 0;
  let realizedCostHt = 0;
  let theoreticalCostHt = 0;
  let theoComplete = true;

  for (const r of rows) {
    if (r.qtySold <= 0) continue;
    const fc = await computeDishFoodCostHt(restaurantId, r.dishId);
    if (fc.costIsComplete) {
      theoreticalCostHt += fc.foodCostHt * r.qtySold;
    } else {
      theoComplete = false;
    }
    if (r.revenueHt != null && r.revenueHt > 0) {
      revenueHt += r.revenueHt;
      if (r.marginHt != null) {
        realizedCostHt += r.revenueHt - r.marginHt;
      }
    }
  }

  realizedCostHt += wasteCostHt;

  const theoreticalFoodCostPct =
    revenueHt > 0 && theoComplete ? roundMoney((theoreticalCostHt / revenueHt) * 100) : null;
  const realizedFoodCostPct = revenueHt > 0 ? roundMoney((realizedCostHt / revenueHt) * 100) : null;
  const gapPctPoints =
    theoreticalFoodCostPct != null && realizedFoodCostPct != null
      ? roundMoney(realizedFoodCostPct - theoreticalFoodCostPct)
      : null;

  return {
    theoreticalFoodCostPct,
    realizedFoodCostPct,
    gapPctPoints,
    revenueHt: roundMoney(revenueHt),
    theoreticalCostHt: roundMoney(theoreticalCostHt),
    realizedCostHt: roundMoney(realizedCostHt),
  };
}

export async function buildDeterministicAnalysisPayload(
  restaurantId: string,
  from: string,
  to: string
): Promise<DeterministicAnalysisPayload> {
  const [sales, waste, feedback] = await Promise.all([
    getSalesInsightsData(restaurantId, from, to),
    buildWasteSummary(restaurantId, from, to),
    buildFeedbackSummary(restaurantId, from, to),
  ]);

  const { items: menuMatrix, medianQty, medianMarginPct } = await buildMenuMatrix(
    restaurantId,
    sales.rows
  );

  let revenueHt = 0;
  let marginHt = 0;
  for (const r of sales.rows) {
    if (r.revenueHt != null) revenueHt += r.revenueHt;
    if (r.marginHt != null) marginHt += r.marginHt;
  }

  const marginPct = revenueHt > 0 ? roundMoney((marginHt / revenueHt) * 100) : null;
  const foodCostGap = await buildFoodCostGap(restaurantId, sales.rows, waste.totalCostHt);

  const soldRows = sales.rows.filter((r) => r.qtySold > 0);
  const topSeller = soldRows.length
    ? soldRows.reduce((best, r) => (r.qtySold > best.qtySold ? r : best))
    : null;

  const withMargin = soldRows.filter((r) => r.marginPct != null);
  const worstMarginSeller = withMargin.length
    ? withMargin.reduce((worst, r) =>
        (r.marginPct ?? 100) < (worst.marginPct ?? 100) ? r : worst
      )
    : null;

  return {
    period: { from, to },
    generatedAt: new Date().toISOString(),
    serviceCount: sales.meta.serviceCount,
    totals: {
      revenueHt: roundMoney(revenueHt),
      marginHt: roundMoney(marginHt),
      marginPct,
      wasteCostHt: waste.totalCostHt,
    },
    menuMatrix,
    matrixThresholds: { medianQty, medianMarginPct },
    foodCostGap,
    waste,
    feedback,
    highlights: {
      topSeller: topSeller
        ? { dishId: topSeller.dishId, dishName: topSeller.dishName, qty: topSeller.qtySold }
        : null,
      worstMarginSeller: worstMarginSeller
        ? {
            dishId: worstMarginSeller.dishId,
            dishName: worstMarginSeller.dishName,
            marginPct: worstMarginSeller.marginPct!,
            qty: worstMarginSeller.qtySold,
          }
        : null,
    },
  };
}

export type RecommendationDraft = {
  recommendation_type: string;
  title: string;
  body: string;
  dish_id?: string | null;
  inventory_item_id?: string | null;
  suggested_qty_delta?: number | null;
  suggested_qty_absolute?: number | null;
};

/** Recommandations actionnables dérivées des chiffres (avant enrichissement IA). */
export async function buildDeterministicRecommendations(
  payload: DeterministicAnalysisPayload,
  restaurantId: string
): Promise<RecommendationDraft[]> {
  const out: RecommendationDraft[] = [];

  for (const item of payload.menuMatrix.filter((m) => m.quadrant === "plowhorse").slice(0, 3)) {
    out.push({
      recommendation_type: "menu_pricing",
      title: `Revoir le prix ou le coût — ${item.dishName}`,
      body: `${QUADRANT_LABELS.plowhorse} : ${item.qtySold} ventes mais marge ${item.marginPct?.toFixed(1) ?? "—"} %. Envisagez une hausse tarifaire ou une optimisation recette.`,
      dish_id: item.dishId,
    });

    const componentRec = await suggestLargestComponentReduction(restaurantId, item.dishId, item.dishName);
    if (componentRec) out.push(componentRec);
  }

  for (const item of payload.menuMatrix.filter((m) => m.quadrant === "dog").slice(0, 2)) {
    out.push({
      recommendation_type: "operational",
      title: `Poids mort — ${item.dishName}`,
      body: `Peu vendu (${item.qtySold}) et marge faible. Retirer de la carte ou reformuler la recette ?`,
      dish_id: item.dishId,
    });
  }

  if (payload.waste.totalCostHt > 50) {
    out.push({
      recommendation_type: "operational",
      title: "Gaspillage significatif sur la période",
      body: `${payload.waste.totalCostHt.toFixed(0)} € HT de pertes enregistrées. Priorisez les causes : ${Object.entries(payload.waste.byReason)
        .sort((a, b) => b[1].costHt - a[1].costHt)
        .slice(0, 2)
        .map(([k]) => k)
        .join(", ")}.`,
    });
  }

  const stressTotal =
    payload.feedback.stressDistribution.hell +
    payload.feedback.stressDistribution.tense +
    payload.feedback.stressDistribution.smooth;
  if (stressTotal >= 3) {
    const tenseRatio = (payload.feedback.stressDistribution.hell + payload.feedback.stressDistribution.tense) / stressTotal;
    if (tenseRatio >= 0.5) {
      out.push({
        recommendation_type: "operational",
        title: "Charge équipe élevée en salle/cuisine",
        body: `${Math.round(tenseRatio * 100)} % des retours terrain signalent un service tendu ou difficile. Envisagez un renfort ou une simplification du menu en coup de feu.`,
      });
    }
  }

  for (const bn of payload.feedback.bottleneckDishes.slice(0, 2)) {
    const dish = payload.menuMatrix.find((m) => m.dishId === bn.dishId);
    out.push({
      recommendation_type: "operational",
      title: `Goulot d'étranglement — ${dish?.dishName ?? "Plat"}`,
      body: `Signalé ${bn.count} fois comme source de stress ou retours assiettes. Vérifier la fiche technique et la mise en place.`,
      dish_id: bn.dishId,
    });
  }

  return out.slice(0, 10);
}

async function suggestLargestComponentReduction(
  restaurantId: string,
  dishId: string,
  dishName: string
): Promise<RecommendationDraft | null> {
  const fc = await computeDishFoodCostHt(restaurantId, dishId);
  if (!fc.costIsComplete || fc.breakdown.length === 0) return null;

  const top = [...fc.breakdown].sort((a, b) => (b.lineCostHt ?? 0) - (a.lineCostHt ?? 0))[0];
  if (!top || top.lineCostHt == null || top.qty <= 0) return null;

  const delta = -roundMoney(top.qty * 0.1);
  if (delta === 0) return null;

  return {
    recommendation_type: "reduce_component_qty",
    title: `Réduire ${top.name} sur ${dishName}`,
    body: `${top.name} représente une part importante du coût matière. Proposition : −10 % (${top.qty} → ${roundMoney(top.qty + delta)} ${top.unit}).`,
    dish_id: dishId,
    inventory_item_id: top.inventoryItemId,
    suggested_qty_delta: delta,
  };
}
