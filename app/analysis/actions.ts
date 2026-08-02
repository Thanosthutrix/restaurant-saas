"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantMembership } from "@/lib/auth/restaurantActionAccess";
import {
  buildDeterministicAnalysisPayload,
  buildDeterministicRecommendations,
} from "@/lib/analysis/analysisReportBuilder";
import {
  createAnalysisReport,
  finalizeAnalysisReport,
  getAnalysisReportById,
  getLatestAnalysisReport,
  insertAnalysisRecommendations,
  dismissRecommendation,
} from "@/lib/analysis/analysisReportDb";
import { applyAnalysisRecommendation } from "@/lib/analysis/applyRecommendation";
import { generateCoachPayload } from "@/lib/analysis/coachPrompt";
import { insertAnonymousFeedbackBatch } from "@/lib/analysis/feedbackDb";
import {
  saveOrderAnomalyResponse,
  type OrderAdjustmentAnomalyType,
} from "@/lib/analysis/orderAnomalyTriggers";
import {
  recordQuestionsShown,
  selectShiftClosingQuestions,
} from "@/lib/analysis/questionSelectorEngine";
import type { UltimateAnalysisReport } from "@/lib/analysis/reportTypes";
import { createWasteLog, listRecentWasteLogs } from "@/lib/analysis/wasteDb";
import type {
  SelectedShiftQuestion,
  ShiftClosingQuestionSet,
  WasteReason,
  WasteType,
} from "@/lib/analysis/types";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function requireUserRestaurant(
  restaurantId: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Connectez-vous pour continuer." };
  const gate = await assertRestaurantMembership(user.id, restaurantId);
  if (!gate.ok) return { ok: false, error: gate.error };
  return { ok: true, userId: user.id };
}

/** Charge les 3 questions contextualisées pour la clôture de service. */
export async function fetchShiftClosingQuestionsAction(params: {
  restaurantId: string;
  serviceId: string;
}): Promise<ActionResult<ShiftClosingQuestionSet>> {
  const auth = await requireUserRestaurant(params.restaurantId);
  if (!auth.ok) return auth;

  const result = await selectShiftClosingQuestions({
    restaurantId: params.restaurantId,
    serviceId: params.serviceId,
    userId: auth.userId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  await recordQuestionsShown({
    userId: auth.userId,
    restaurantId: params.restaurantId,
    serviceId: params.serviceId,
    questions: result.data.questions.map((q) => ({
      templateId: q.templateId,
      contextKey: q.contextKey,
    })),
  });

  return { ok: true, data: result.data };
}

export type ShiftFeedbackAnswer = {
  templateId: string;
  templateKey: string;
  category: SelectedShiftQuestion["category"];
  contextKey: string;
  responsePayload: Record<string, unknown>;
};

/** Enregistre les réponses anonymes (sans lien utilisateur). */
export async function submitShiftClosingFeedbackAction(params: {
  restaurantId: string;
  serviceId: string;
  answers: ShiftFeedbackAnswer[];
}): Promise<ActionResult> {
  const auth = await requireUserRestaurant(params.restaurantId);
  if (!auth.ok) return auth;

  if (params.answers.length === 0) {
    return { ok: true };
  }

  const { error } = await insertAnonymousFeedbackBatch(
    params.answers.map((a) => ({
      restaurantId: params.restaurantId,
      serviceId: params.serviceId,
      templateId: a.templateId,
      templateKey: a.templateKey,
      category: a.category,
      contextKey: a.contextKey,
      responsePayload: a.responsePayload,
    }))
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logWasteAction(params: {
  restaurantId: string;
  serviceId?: string | null;
  inventoryItemId?: string | null;
  dishId?: string | null;
  wasteType: WasteType;
  reason: WasteReason;
  quantity: number;
  unit: string;
  notes?: string | null;
}): Promise<ActionResult<{ wasteLogId: string }>> {
  const auth = await requireUserRestaurant(params.restaurantId);
  if (!auth.ok) return auth;

  const { data, error } = await createWasteLog({
    restaurantId: params.restaurantId,
    serviceId: params.serviceId,
    inventoryItemId: params.inventoryItemId,
    dishId: params.dishId,
    wasteType: params.wasteType,
    reason: params.reason,
    quantity: params.quantity,
    unit: params.unit,
    notes: params.notes,
    loggedBy: auth.userId,
    applyStock: Boolean(params.inventoryItemId),
  });

  if (error || !data) return { ok: false, error: error?.message ?? "Impossible d'enregistrer la perte." };

  revalidatePath("/cuisine/pertes");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { ok: true, data: { wasteLogId: data.id } };
}

export async function fetchRecentWasteLogsAction(
  restaurantId: string
): Promise<ActionResult<Awaited<ReturnType<typeof listRecentWasteLogs>>["data"]>> {
  const auth = await requireUserRestaurant(restaurantId);
  if (!auth.ok) return auth;

  const { data, error } = await listRecentWasteLogs(restaurantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function saveOrderAnomalyResponseAction(params: {
  restaurantId: string;
  orderDraftId?: string | null;
  orderDraftLineId?: string | null;
  inventoryItemId: string;
  anomalyType: OrderAdjustmentAnomalyType;
  suggestedQty: number;
  adjustedQty: number;
  theoreticalStockQty: number;
  explanationCode: string;
  explanationNote?: string | null;
  source?: "order_draft" | "suggestion";
}): Promise<ActionResult> {
  const auth = await requireUserRestaurant(params.restaurantId);
  if (!auth.ok) return auth;

  const { error } = await saveOrderAnomalyResponse({
    ...params,
    respondedBy: auth.userId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Rapport d'analyse ultime ───────────────────────────────────────────────

export async function generateUltimateAnalysisReportAction(params: {
  restaurantId: string;
  from: string;
  to: string;
}): Promise<ActionResult<{ reportId: string }>> {
  const auth = await requireUserRestaurant(params.restaurantId);
  if (!auth.ok) return auth;

  let from = params.from;
  let to = params.to;
  if (from > to) {
    const x = from;
    from = to;
    to = x;
  }

  const deterministic = await buildDeterministicAnalysisPayload(params.restaurantId, from, to);

  const { id: reportId, error: createErr } = await createAnalysisReport({
    restaurantId: params.restaurantId,
    periodStart: from,
    periodEnd: to,
    deterministic,
  });

  if (createErr || !reportId) {
    return { ok: false, error: createErr?.message ?? "Impossible de créer le rapport." };
  }

  const deterministicRecs = await buildDeterministicRecommendations(deterministic, params.restaurantId);
  const { coach } = await generateCoachPayload(deterministic);

  const coachRecs = (coach?.insights ?? []).map((i) => ({
    recommendation_type: "operational" as const,
    title: i.title,
    body: i.body,
    dish_id: i.relatedDishId ?? null,
    inventory_item_id: i.relatedInventoryItemId ?? null,
  }));

  const { error: recErr } = await insertAnalysisRecommendations(
    reportId,
    params.restaurantId,
    [...deterministicRecs, ...coachRecs].slice(0, 12)
  );
  if (recErr) {
    await finalizeAnalysisReport({ reportId, coach: null, status: "failed" });
    return { ok: false, error: recErr.message };
  }

  await finalizeAnalysisReport({ reportId, coach, status: "ready" });

  revalidatePath("/pilotage/analyse");
  return { ok: true, data: { reportId } };
}

export async function fetchLatestAnalysisReportAction(
  restaurantId: string
): Promise<ActionResult<UltimateAnalysisReport | null>> {
  const auth = await requireUserRestaurant(restaurantId);
  if (!auth.ok) return auth;

  const { data, error } = await getLatestAnalysisReport(restaurantId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function fetchAnalysisReportAction(params: {
  restaurantId: string;
  reportId: string;
}): Promise<ActionResult<UltimateAnalysisReport>> {
  const auth = await requireUserRestaurant(params.restaurantId);
  if (!auth.ok) return auth;

  const { data, error } = await getAnalysisReportById(params.reportId, params.restaurantId);
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Rapport introuvable." };
  return { ok: true, data };
}

export async function applyAnalysisRecommendationAction(params: {
  restaurantId: string;
  recommendationId: string;
}): Promise<ActionResult<{ newQty?: number }>> {
  const auth = await requireUserRestaurant(params.restaurantId);
  if (!auth.ok) return auth;

  const result = await applyAnalysisRecommendation({
    recommendationId: params.recommendationId,
    restaurantId: params.restaurantId,
    userId: auth.userId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/pilotage/analyse");
  revalidatePath("/dishes");
  revalidatePath("/margins");
  return { ok: true, data: { newQty: result.newQty } };
}

export async function dismissAnalysisRecommendationAction(params: {
  restaurantId: string;
  recommendationId: string;
}): Promise<ActionResult> {
  const auth = await requireUserRestaurant(params.restaurantId);
  if (!auth.ok) return auth;

  const { error } = await dismissRecommendation(params.recommendationId, params.restaurantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/pilotage/analyse");
  return { ok: true };
}
