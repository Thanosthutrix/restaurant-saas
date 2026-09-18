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
import type { BlConversionInventoryHint } from "@/lib/receiving/blStockConversion";

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * Après upload d’un BL sans commande app : extrait les lignes (IA), rattache les articles stock si possible.
 */
export async function runDeliveryNoteAnalysis(
  deliveryNoteId: string,
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: note, error: nErr } = await supabaseServer
    .from("delivery_notes")
    .select(
      "id, restaurant_id, supplier_id, file_path, file_name, file_url, status, purchase_order_id"
    )
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
    purchase_order_id: string | null;
  };

  if (row.status !== "draft") {
    return { ok: false, error: "Seules les réceptions en brouillon peuvent être analysées." };
  }

  const { data: existingRows } = await supabaseServer
    .from("delivery_note_lines")
    .select("id")
    .eq("delivery_note_id", deliveryNoteId)
    .limit(1);

  if (existingRows && existingRows.length > 0) {
    return { ok: true };
  }

  const publicUrl =
    row.file_url ?? (row.file_path ? getDeliveryNoteFileUrl(row.file_path) : null);
  if (!publicUrl) {
    return { ok: false, error: "Aucun fichier BL associé." };
  }

  const fileName = row.file_name ?? "bl.jpg";
  const outcome = await analyzeDeliveryNoteDocument(publicUrl, fileName);
  const now = new Date().toISOString();

  if (outcome.kind === "skipped_no_key" || outcome.kind === "skipped_pdf") {
    await supabaseServer
      .from("delivery_notes")
      .update({
        notes: outcome.message,
        updated_at: now,
      })
      .eq("id", deliveryNoteId)
      .eq("restaurant_id", restaurantId);
    return { ok: true };
  }

  if (outcome.kind === "error") {
    await supabaseServer
      .from("delivery_notes")
      .update({
        notes: `Analyse BL : ${outcome.message}`,
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

  const repeatedLabelHallucination = looksLikeRepeatedLabelHallucination(parsedLines);

  const coherence = coherenceNoteForLines(parsedLines);
  const baseNote = supplierNameOnDoc
    ? `Fournisseur sur le document : ${supplierNameOnDoc}. Analyse v${DELIVERY_NOTE_ANALYSIS_VERSION}.`
    : `Analyse BL v${DELIVERY_NOTE_ANALYSIS_VERSION}.`;

  const confidenceNote =
    confidence === "high" && repeatedLabelHallucination
      ? "Analyse non enregistrée : tous les libellés extraits sont identiques (erreur fréquente du modèle). Saisie manuelle des lignes."
      : confidence === "high"
        ? null
        : confidence === "low"
          ? `Confiance IA : partielle — lignes non enregistrées automatiquement (saisie manuelle).${extractionNotes ? ` ${extractionNotes}` : ""}`
          : `Confiance IA : lecture impossible — aucune ligne enregistrée.${extractionNotes ? ` ${extractionNotes}` : ""}`;

  const notesParts = [baseNote, confidenceNote, coherence].filter(Boolean) as string[];
  const notePatch: Record<string, unknown> = {
    raw_text: rawText,
    updated_at: now,
    notes: notesParts.join(" "),
  };
  if (blNumber) notePatch.number = blNumber;
  if (deliveryDate) notePatch.delivery_date = deliveryDate;

  await supabaseServer
    .from("delivery_notes")
    .update(notePatch)
    .eq("id", deliveryNoteId)
    .eq("restaurant_id", restaurantId);

  /** Insérer uniquement si confiance haute et pas de libellé unique répété sur toutes les lignes (hallucination). */
  if (confidence !== "high" || parsedLines.length === 0 || repeatedLabelHallucination) {
    return { ok: true };
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

  return { ok: true };
}

/** @deprecated Utiliser parseNumericField depuis delivery-note-parse */
export { parseNumericField } from "@/lib/delivery-note-parse";
