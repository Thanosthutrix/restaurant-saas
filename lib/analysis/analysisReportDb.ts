/**
 * Persistance des rapports d'analyse et recommandations.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import type { CoachPayload, DeterministicAnalysisPayload, UltimateAnalysisReport } from "@/lib/analysis/reportTypes";
import type { RecommendationDraft } from "@/lib/analysis/analysisReportBuilder";
import type { AnalysisRecommendationRow } from "@/lib/analysis/reportTypes";

export async function createAnalysisReport(params: {
  restaurantId: string;
  periodStart: string;
  periodEnd: string;
  deterministic: DeterministicAnalysisPayload;
}): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("analysis_reports")
    .insert({
      restaurant_id: params.restaurantId,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      deterministic_payload: params.deterministic,
      status: "computing",
    })
    .select("id")
    .single();

  if (error) return { id: null, error: new Error(error.message) };
  return { id: String(data.id), error: null };
}

export async function finalizeAnalysisReport(params: {
  reportId: string;
  coach: CoachPayload | null;
  status?: "ready" | "failed";
}): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("analysis_reports")
    .update({
      coach_payload: params.coach,
      coach_generated_at: params.coach?.generatedAt ?? null,
      status: params.status ?? "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.reportId);

  return { error: error ? new Error(error.message) : null };
}

export async function insertAnalysisRecommendations(
  reportId: string,
  restaurantId: string,
  drafts: RecommendationDraft[]
): Promise<{ error: Error | null }> {
  if (drafts.length === 0) return { error: null };

  const rows = drafts.map((d) => ({
    report_id: reportId,
    restaurant_id: restaurantId,
    recommendation_type: d.recommendation_type,
    title: d.title,
    body: d.body,
    dish_id: d.dish_id ?? null,
    inventory_item_id: d.inventory_item_id ?? null,
    suggested_qty_delta: d.suggested_qty_delta ?? null,
    suggested_qty_absolute: d.suggested_qty_absolute ?? null,
    status: "pending",
  }));

  const { error } = await supabaseServer.from("analysis_recommendations").insert(rows);
  return { error: error ? new Error(error.message) : null };
}

export async function getLatestAnalysisReport(
  restaurantId: string
): Promise<{ data: UltimateAnalysisReport | null; error: Error | null }> {
  const { data: report, error } = await supabaseServer
    .from("analysis_reports")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!report) return { data: null, error: null };

  return loadReportWithRecommendations(report);
}

export async function getAnalysisReportById(
  reportId: string,
  restaurantId: string
): Promise<{ data: UltimateAnalysisReport | null; error: Error | null }> {
  const { data: report, error } = await supabaseServer
    .from("analysis_reports")
    .select("*")
    .eq("id", reportId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!report) return { data: null, error: null };

  return loadReportWithRecommendations(report);
}

async function loadReportWithRecommendations(
  report: Record<string, unknown>
): Promise<{ data: UltimateAnalysisReport; error: Error | null }> {
  const reportId = String(report.id);
  const { data: recs, error: recErr } = await supabaseServer
    .from("analysis_recommendations")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  if (recErr) return { data: null as unknown as UltimateAnalysisReport, error: new Error(recErr.message) };

  return {
    data: {
      id: reportId,
      restaurantId: String(report.restaurant_id),
      periodStart: String(report.period_start),
      periodEnd: String(report.period_end),
      status: report.status as UltimateAnalysisReport["status"],
      deterministic: report.deterministic_payload as DeterministicAnalysisPayload,
      coach: (report.coach_payload as CoachPayload | null) ?? null,
      recommendations: (recs ?? []) as AnalysisRecommendationRow[],
    },
    error: null,
  };
}

export async function dismissRecommendation(
  recommendationId: string,
  restaurantId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("analysis_recommendations")
    .update({ status: "dismissed" })
    .eq("id", recommendationId)
    .eq("restaurant_id", restaurantId);

  return { error: error ? new Error(error.message) : null };
}

export async function markRecommendationApplied(
  recommendationId: string,
  restaurantId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabaseServer
    .from("analysis_recommendations")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_by: userId,
    })
    .eq("id", recommendationId)
    .eq("restaurant_id", restaurantId);

  return { error: error ? new Error(error.message) : null };
}

export async function getRecommendationById(
  recommendationId: string,
  restaurantId: string
): Promise<{ data: AnalysisRecommendationRow | null; error: Error | null }> {
  const { data, error } = await supabaseServer
    .from("analysis_recommendations")
    .select("*")
    .eq("id", recommendationId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: (data as AnalysisRecommendationRow) ?? null, error: null };
}
