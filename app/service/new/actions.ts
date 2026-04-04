"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createService, getService, updateServiceAnalysis } from "@/lib/db";
import { mergeSales } from "@/lib/ticket-match";
import { recordServiceSalesAndApplyStock } from "@/lib/service/recordServiceSalesAndApplyStock";
import { findDishMatchCandidates, SUGGESTION_SCORE_MIN } from "@/lib/matching/findDishMatchCandidates";
import type { DishCandidate } from "@/lib/matching/findDishMatchCandidates";
import { ANALYSIS_VERSION, analyzeTicketImage } from "@/lib/ticket-analysis";
import type { ServiceType } from "@/lib/constants";

export type TicketLineStatus = "matched" | "suggested" | "unmatched";

export type AnalyzedTicketLine = {
  raw_label: string;
  normalized_label: string;
  qty: number;
  status: TicketLineStatus;
  matched_dish_id: string | null;
  matched_dish_name: string | null;
  suggestions: { dish_id: string; dish_name: string; score: number }[];
};

export type AnalyzeReceiptResult =
  | {
      success: true;
      lines: AnalyzedTicketLine[];
      matchedSales: { dish_id: string; qty: number }[];
      totalDetected: number;
    }
  | { success: false; error: string };

/**
 * Analyse une photo de relevé et retourne, par ligne : statut (matched / suggested / unmatched),
 * ventes auto-associées (matched uniquement), et suggestions pour les autres.
 */
export async function analyzeReceiptAndMatch(
  restaurantId: string,
  imageUrl: string
): Promise<AnalyzeReceiptResult> {
  const analysis = await analyzeTicketImage(imageUrl);
  if (analysis.error && (analysis.items ?? []).length === 0) {
    return { success: false, error: analysis.error };
  }
  const items = analysis.items ?? [];
  if (items.length === 0) {
    return { success: false, error: "Aucune vente détectée sur le relevé." };
  }

  const lines: AnalyzedTicketLine[] = [];
  const matchedSales: { dish_id: string; qty: number }[] = [];

  for (const item of items) {
    const match = await findDishMatchCandidates(restaurantId, item.name);
    const suggestions: { dish_id: string; dish_name: string; score: number }[] = match.candidates
      .filter((c) => c.score >= SUGGESTION_SCORE_MIN)
      .map((c: DishCandidate) => ({ dish_id: c.dishId, dish_name: c.dishName, score: c.score }));

    let status: TicketLineStatus = "unmatched";
    let matched_dish_id: string | null = null;
    let matched_dish_name: string | null = null;

    if (match.exactDishId && match.exactDishName) {
      status = "matched";
      matched_dish_id = match.exactDishId;
      matched_dish_name = match.exactDishName;
      matchedSales.push({ dish_id: match.exactDishId, qty: item.qty });
    } else if (suggestions.length > 0) {
      status = "suggested";
    }

    lines.push({
      raw_label: item.name,
      normalized_label: match.normalizedLabel,
      qty: item.qty,
      status,
      matched_dish_id,
      matched_dish_name,
      suggestions,
    });
  }

  return {
    success: true,
    lines,
    matchedSales,
    totalDetected: items.length,
  };
}

export type CreateServiceResult = { success: false; error: string } | { success: true; serviceId: string };

export async function createServiceAndSales(
  restaurantId: string,
  serviceDate: string,
  serviceType: ServiceType,
  sales: { dish_id: string; qty: number }[],
  imageUrl?: string | null
): Promise<CreateServiceResult> {
  if (!restaurantId || !serviceDate || !serviceType) {
    return { success: false, error: "Restaurant, date et type de service requis." };
  }

  const { data: service, error: serviceError } = await createService(
    restaurantId,
    serviceDate,
    serviceType,
    imageUrl ?? null
  );

  if (serviceError) {
    return { success: false, error: serviceError.message };
  }
  if (!service) {
    return { success: false, error: "Impossible de créer le service." };
  }

  let salesToInsert = sales;
  const extracted_items: { name: string; qty: number }[] = [];
  const matched_items: { item: { name: string; qty: number }; dishName: string }[] = [];
  const unmatched_items: { name: string; qty: number }[] = [];

  if (imageUrl) {
    const current = await getService(service.id);
    const existingRaw = current.data?.analysis_result_json ?? null;
    const existingVersion = current.data?.analysis_version ?? null;
    const existingJson =
      existingRaw == null ? null : typeof existingRaw === "string" ? existingRaw : JSON.stringify(existingRaw);

    const analysis = await analyzeTicketImage(imageUrl, {
      cachedResultJson: existingJson,
      cachedVersion: existingVersion,
    });
    const items = analysis?.items ?? [];
    const analysisResult = { items };

    extracted_items.push(...items);

    const updatePayload = {
      analysis_status: analysis.error ? "error" : "done",
      analysis_result_json: analysisResult,
      analysis_error: analysis.error ?? null,
      analysis_version: ANALYSIS_VERSION,
    };
    console.log("DEBUG analysisResult =", JSON.stringify(analysisResult));

    const updateError = await updateServiceAnalysis(service.id, updatePayload);
    if (updateError.error) {
      console.error("[createServiceAndSales] updateServiceAnalysis FAILED:", updateError.error.message);
    } else {
      console.log("[createServiceAndSales] updateServiceAnalysis OK");
    }

    if (items.length > 0) {
      const analyzedSales: { dish_id: string; qty: number }[] = [];

      for (const item of items) {
        const match = await findDishMatchCandidates(restaurantId, item.name);
        if (match.exactDishId && match.exactDishName) {
          matched_items.push({ item, dishName: match.exactDishName });
          analyzedSales.push({ dish_id: match.exactDishId, qty: item.qty });
        } else {
          unmatched_items.push(item);
        }
      }

      console.log("[createServiceAndSales] matched_items:", JSON.stringify(matched_items));
      console.log("[createServiceAndSales] unmatched_items:", JSON.stringify(unmatched_items));

      salesToInsert = mergeSales(sales, analyzedSales);
    }
  }

  console.log("[createServiceAndSales] service_sales + stock:", JSON.stringify(salesToInsert));
  const { error: stockErr } = await recordServiceSalesAndApplyStock({
    serviceId: service.id,
    restaurantId,
    sales: salesToInsert,
  });
  if (stockErr) {
    return {
      success: false,
      error:
        stockErr.message.includes("stock") || stockErr.message.includes("FIFO")
          ? `Ventes enregistrées mais erreur lors de la mise à jour du stock : ${stockErr.message}`
          : stockErr.message,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/orders/suggestions");
  redirect("/dashboard");
}
