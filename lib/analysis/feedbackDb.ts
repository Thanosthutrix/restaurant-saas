/**
 * Persistance des micro-sondages anonymes et historique cooldown utilisateur.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import type { FeedbackQuestionCategory } from "@/lib/analysis/types";

export type AnonymousFeedbackInput = {
  restaurantId: string;
  serviceId: string;
  templateId: string;
  templateKey: string;
  category: FeedbackQuestionCategory;
  contextKey: string;
  responsePayload: Record<string, unknown>;
};

export async function insertAnonymousFeedbackBatch(
  rows: AnonymousFeedbackInput[]
): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null };

  const payload = rows.map((r) => ({
    restaurant_id: r.restaurantId,
    service_id: r.serviceId,
    template_id: r.templateId,
    template_key: r.templateKey,
    category: r.category,
    context_key: r.contextKey,
    response_payload: r.responsePayload,
  }));

  const { error } = await supabaseServer.from("anonymous_feedback").insert(payload);
  return { error: error ? new Error(error.message) : null };
}

export async function countAnonymousFeedbackByCategory(
  restaurantId: string,
  fromDate: string,
  toDate: string
): Promise<Map<FeedbackQuestionCategory, number>> {
  const { data, error } = await supabaseServer
    .from("anonymous_feedback")
    .select("category")
    .eq("restaurant_id", restaurantId)
    .gte("submitted_at", `${fromDate}T00:00:00Z`)
    .lte("submitted_at", `${toDate}T23:59:59Z`);

  const out = new Map<FeedbackQuestionCategory, number>();
  if (error || !data) return out;

  for (const row of data) {
    const cat = String(row.category) as FeedbackQuestionCategory;
    out.set(cat, (out.get(cat) ?? 0) + 1);
  }
  return out;
}
