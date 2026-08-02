/**
 * Application en 1 clic d'une recommandation sur dish_components.
 */

import { supabaseServer } from "@/lib/supabaseServer";
import {
  getRecommendationById,
  markRecommendationApplied,
} from "@/lib/analysis/analysisReportDb";
import type { AnalysisRecommendationRow } from "@/lib/analysis/reportTypes";

const MIN_QTY = 0.001;

export async function applyAnalysisRecommendation(params: {
  recommendationId: string;
  restaurantId: string;
  userId: string;
}): Promise<{ ok: true; newQty?: number } | { ok: false; error: string }> {
  const { data: rec, error: fetchErr } = await getRecommendationById(
    params.recommendationId,
    params.restaurantId
  );

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!rec) return { ok: false, error: "Recommandation introuvable." };
  if (rec.status === "applied") return { ok: false, error: "Déjà appliquée." };
  if (rec.status === "dismissed") return { ok: false, error: "Recommandation ignorée." };

  const applyResult = await applyRecommendationToRecipe(rec, params.restaurantId);
  if (!applyResult.ok) return applyResult;

  const { error: markErr } = await markRecommendationApplied(
    params.recommendationId,
    params.restaurantId,
    params.userId
  );
  if (markErr) return { ok: false, error: markErr.message };

  return { ok: true, newQty: applyResult.newQty };
}

async function applyRecommendationToRecipe(
  rec: AnalysisRecommendationRow,
  restaurantId: string
): Promise<{ ok: true; newQty?: number } | { ok: false; error: string }> {
  switch (rec.recommendation_type) {
    case "reduce_component_qty":
    case "increase_component_qty":
      return applyComponentQtyChange(rec, restaurantId);

    case "menu_pricing":
    case "operational":
    case "other":
      return { ok: true };

    default:
      return { ok: false, error: `Type de recommandation non supporté : ${rec.recommendation_type}` };
  }
}

async function applyComponentQtyChange(
  rec: AnalysisRecommendationRow,
  restaurantId: string
): Promise<{ ok: true; newQty: number } | { ok: false; error: string }> {
  if (!rec.dish_id || !rec.inventory_item_id) {
    return {
      ok: false,
      error: "Cette recommandation ne cible pas une ligne de fiche technique.",
    };
  }

  const { data: row, error: fetchErr } = await supabaseServer
    .from("dish_components")
    .select("id, qty")
    .eq("restaurant_id", restaurantId)
    .eq("dish_id", rec.dish_id)
    .eq("inventory_item_id", rec.inventory_item_id)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) {
    return { ok: false, error: "Composant introuvable sur la fiche technique du plat." };
  }

  const currentQty = Number(row.qty);
  let newQty: number;

  if (rec.suggested_qty_absolute != null && Number.isFinite(Number(rec.suggested_qty_absolute))) {
    newQty = Number(rec.suggested_qty_absolute);
  } else if (rec.suggested_qty_delta != null && Number.isFinite(Number(rec.suggested_qty_delta))) {
    newQty = currentQty + Number(rec.suggested_qty_delta);
  } else if (rec.recommendation_type === "reduce_component_qty") {
    newQty = currentQty * 0.9;
  } else {
    newQty = currentQty * 1.05;
  }

  if (newQty < MIN_QTY) {
    return { ok: false, error: "La quantité résultante serait trop faible." };
  }

  newQty = Math.round(newQty * 1000) / 1000;

  const { error: updErr } = await supabaseServer
    .from("dish_components")
    .update({ qty: newQty })
    .eq("id", row.id)
    .eq("restaurant_id", restaurantId);

  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true, newQty };
}
