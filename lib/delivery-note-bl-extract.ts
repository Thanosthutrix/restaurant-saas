import { supabaseServer } from "@/lib/supabaseServer";
import {
  analyzeDeliveryNoteDocument,
  DELIVERY_NOTE_ANALYSIS_VERSION,
} from "@/lib/delivery-note-openai";
import { getDeliveryNoteFileUrl } from "@/lib/db";
import { fetchDeliveryLabelAliasMap, fetchDeliveryLabelConversionHintsMap } from "@/lib/inventoryDeliveryLabelAliases";
import {
  buildDeliveryNoteLineRows,
  coherenceNoteForLines,
  looksLikeRepeatedLabelHallucination,
  parseExtractionConfidence,
  parseLinesFromDeliveryNoteJson,
} from "@/lib/delivery-note-parse";
import { matchInventoryItemForLabel } from "@/lib/matching/findInventoryMatchCandidates";
import type { BlConversionInventoryHint } from "@/lib/receiving/blStockConversion";

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export type BlExtractionResult =
  | { ok: true; insertedCount: number; rawLineCount: number; linkedCount: number; userMessage: string }
  | { ok: false; error: string };

function buildUserMessage(
  inserted: number,
  linkedCount: number,
  rawFromModel: number,
  confidence: "high" | "low" | "unreadable",
  repeatedHallucination: boolean,
  extractionNotes: string | null
): string {
  if (repeatedHallucination) {
    return "Lecture rejetée : tous les libellés extraits sont identiques (erreur fréquente du modèle). Photographiez le tableau des articles de plus près, ou saisissez les lignes à la main.";
  }
  if (confidence === "unreadable") {
    return `Document illisible ou trop flou.${extractionNotes ? ` ${extractionNotes}` : ""} Utilisez une photo nette du tableau des articles, ou saisissez les lignes manuellement.`;
  }
  if (inserted === 0) {
    if (rawFromModel === 0) {
      return "Aucune ligne détectée dans le tableau. Cadrez la photo sur les lignes articles (désignation, quantité, prix).";
    }
    return "Des lignes ont été lues mais filtrées (totaux ou libellés vides). Vérifiez la photo ou saisissez à la main.";
  }
  const linkPart =
    linkedCount === inserted
      ? "Toutes les lignes sont liées à un produit stock."
      : linkedCount > 0
        ? `${linkedCount} ligne${linkedCount > 1 ? "s" : ""} liée${linkedCount > 1 ? "s" : ""} au stock — choisissez le produit pour les autres via le menu déroulant.`
        : "Aucune liaison stock automatique — associez chaque ligne au produit correspondant (le système mémorise pour ce fournisseur).";
  const confPart =
    confidence === "low"
      ? " Confiance partielle : vérifiez chaque libellé et quantité."
      : "";
  return `${inserted} ligne${inserted > 1 ? "s" : ""} importée${inserted > 1 ? "s" : ""}. ${linkPart}${confPart}`;
}

/**
 * Lit le BL (photo) via OpenAI (pipeline structuré v7), remplace les lignes brouillon
 * et tente de lier chaque ligne à un produit stock.
 */
export async function runDeliveryNoteBlExtraction(
  deliveryNoteId: string,
  restaurantId: string
): Promise<BlExtractionResult> {
  const { data: note, error: nErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, supplier_id, file_path, file_url, file_name, status")
    .eq("id", deliveryNoteId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (nErr || !note) {
    return { ok: false, error: "Réception introuvable." };
  }

  const row = note as {
    status: string;
    supplier_id: string;
    file_path: string | null;
    file_url: string | null;
    file_name: string | null;
  };

  if (row.status !== "draft") {
    return { ok: false, error: "Seules les réceptions en brouillon peuvent être analysées." };
  }

  const publicUrl =
    row.file_url ?? (row.file_path ? getDeliveryNoteFileUrl(row.file_path) : null);
  if (!publicUrl) {
    return { ok: false, error: "Aucun fichier BL associé." };
  }

  const fileName = row.file_name ?? "bl.jpg";
  const outcome = await analyzeDeliveryNoteDocument(publicUrl, fileName);
  const now = new Date().toISOString();

  if (outcome.kind === "skipped_no_key") {
    await supabaseServer
      .from("delivery_notes")
      .update({ notes: outcome.message, updated_at: now })
      .eq("id", deliveryNoteId)
      .eq("restaurant_id", restaurantId);
    return { ok: false, error: outcome.message };
  }

  if (outcome.kind === "skipped_pdf") {
    await supabaseServer
      .from("delivery_notes")
      .update({ notes: outcome.message, updated_at: now })
      .eq("id", deliveryNoteId)
      .eq("restaurant_id", restaurantId);
    return { ok: false, error: outcome.message };
  }

  if (outcome.kind === "error") {
    await supabaseServer
      .from("delivery_notes")
      .update({
        notes: `Lecture BL : ${outcome.message}`,
        updated_at: now,
      })
      .eq("id", deliveryNoteId)
      .eq("restaurant_id", restaurantId);
    return { ok: false, error: outcome.message };
  }

  const json = outcome.result.json;
  const confidence = parseExtractionConfidence(json.extraction_confidence);
  const extractionNotes = asString(json.extraction_notes);
  const supplierNameOnDoc = asString(json.supplier_name_on_document);
  const blNumber = asString(json.bl_number);
  const deliveryDate = asString(json.delivery_date);
  const rawText = asString(json.raw_text);
  const parsedLines = parseLinesFromDeliveryNoteJson(json);
  const rawLineCount = Array.isArray(json.lines) ? json.lines.length : 0;
  const repeatedHallucination = looksLikeRepeatedLabelHallucination(parsedLines);
  const coherence = coherenceNoteForLines(parsedLines);

  const { data: invRows } = await supabaseServer
    .from("inventory_items")
    .select("id, name, unit, units_per_purchase")
    .eq("restaurant_id", restaurantId);

  const invItems = (invRows ?? []) as { id: string; name: string }[];

  const invById = new Map<string, BlConversionInventoryHint>(
    (invRows ?? []).map((r) => {
      const invRow = r as BlConversionInventoryHint;
      return [invRow.id, invRow];
    })
  );

  const [aliasMap, hintMap] = await Promise.all([
    fetchDeliveryLabelAliasMap(restaurantId, row.supplier_id),
    fetchDeliveryLabelConversionHintsMap(restaurantId, row.supplier_id),
  ]);

  const shouldInsert =
    parsedLines.length > 0 &&
    !repeatedHallucination &&
    (confidence === "high" || confidence === "low");

  const linkedCount = shouldInsert
    ? parsedLines.filter((l) => matchInventoryItemForLabel(l.label, invItems, { aliasMap }) != null).length
    : 0;

  const userMessage = buildUserMessage(
    shouldInsert ? parsedLines.length : 0,
    linkedCount,
    rawLineCount,
    repeatedHallucination ? "unreadable" : confidence,
    repeatedHallucination,
    extractionNotes
  );

  const noteText = [
    supplierNameOnDoc ? `Fournisseur (document) : ${supplierNameOnDoc}.` : null,
    `Lecture BL v${DELIVERY_NOTE_ANALYSIS_VERSION}.`,
    userMessage,
    coherence,
    extractionNotes && confidence !== "high" ? extractionNotes : null,
  ]
    .filter(Boolean)
    .join(" ");

  const patch: Record<string, unknown> = {
    updated_at: now,
    notes: noteText,
    raw_text: rawText,
  };
  if (blNumber) patch.number = blNumber;
  if (deliveryDate) patch.delivery_date = deliveryDate;

  await supabaseServer
    .from("delivery_notes")
    .update(patch)
    .eq("id", deliveryNoteId)
    .eq("restaurant_id", restaurantId);

  await supabaseServer
    .from("delivery_note_lines")
    .delete()
    .eq("delivery_note_id", deliveryNoteId);

  if (!shouldInsert) {
    return {
      ok: true,
      insertedCount: 0,
      rawLineCount,
      linkedCount: 0,
      userMessage,
    };
  }

  const rows = buildDeliveryNoteLineRows(
    deliveryNoteId,
    parsedLines,
    invItems,
    invById,
    aliasMap,
    hintMap
  );

  const { error: insErr } = await supabaseServer.from("delivery_note_lines").insert(rows);
  if (insErr) {
    return { ok: false, error: insErr.message };
  }

  return {
    ok: true,
    insertedCount: parsedLines.length,
    rawLineCount,
    linkedCount,
    userMessage,
  };
}

/** @deprecated Utiliser parseNumericField depuis delivery-note-parse */
export { parseNumericField } from "@/lib/delivery-note-parse";
