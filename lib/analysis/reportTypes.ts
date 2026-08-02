/**
 * Types du rapport d'analyse ultime (payload déterministe + coach IA).
 */

export type MenuMatrixQuadrant = "star" | "plowhorse" | "puzzle" | "dog";

export type MenuMatrixItem = {
  dishId: string;
  dishName: string;
  qtySold: number;
  revenueHt: number | null;
  marginPct: number | null;
  foodCostPct: number | null;
  quadrant: MenuMatrixQuadrant;
};

export type WasteSummary = {
  totalCostHt: number;
  logCount: number;
  byType: Record<string, { count: number; costHt: number }>;
  byReason: Record<string, { count: number; costHt: number }>;
  topItems: { name: string; costHt: number; quantity: number }[];
};

export type FeedbackSummary = {
  totalResponses: number;
  byCategory: Record<string, number>;
  stressDistribution: { hell: number; tense: number; smooth: number; other: number };
  plateReturns: number;
  bottleneckDishes: { dishId: string; count: number }[];
  ingredientQualityAlerts: number;
};

export type FoodCostGap = {
  theoreticalFoodCostPct: number | null;
  realizedFoodCostPct: number | null;
  gapPctPoints: number | null;
  revenueHt: number;
  theoreticalCostHt: number;
  realizedCostHt: number;
};

export type DeterministicAnalysisPayload = {
  period: { from: string; to: string };
  generatedAt: string;
  serviceCount: number;
  totals: {
    revenueHt: number;
    marginHt: number;
    marginPct: number | null;
    wasteCostHt: number;
  };
  menuMatrix: MenuMatrixItem[];
  matrixThresholds: { medianQty: number; medianMarginPct: number };
  foodCostGap: FoodCostGap;
  waste: WasteSummary;
  feedback: FeedbackSummary;
  highlights: {
    topSeller: { dishId: string; dishName: string; qty: number } | null;
    worstMarginSeller: { dishId: string; dishName: string; marginPct: number; qty: number } | null;
  };
};

export type CoachInsight = {
  title: string;
  body: string;
  tone: "encourage" | "alert" | "action";
  relatedDishId?: string | null;
  relatedInventoryItemId?: string | null;
};

export type CoachPayload = {
  summary: string;
  insights: CoachInsight[];
  generatedAt: string;
  model: string;
};

export type AnalysisRecommendationRow = {
  id: string;
  report_id: string;
  restaurant_id: string;
  recommendation_type: string;
  title: string;
  body: string;
  dish_id: string | null;
  inventory_item_id: string | null;
  suggested_qty_delta: number | null;
  suggested_qty_absolute: number | null;
  status: "pending" | "applied" | "dismissed";
  applied_at: string | null;
  created_at: string;
};

export type UltimateAnalysisReport = {
  id: string;
  restaurantId: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "computing" | "ready" | "failed";
  deterministic: DeterministicAnalysisPayload;
  coach: CoachPayload | null;
  recommendations: AnalysisRecommendationRow[];
};
