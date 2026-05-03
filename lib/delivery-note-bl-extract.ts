import { supabaseServer } from "@/lib/supabaseServer";
import { analyzeBlDocument } from "@/lib/bl-openai";
import { BL_ANALYSIS_VERSION } from "@/lib/ticket-analysis";
import { getDeliveryNoteFileUrl } from "@/lib/db";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { matchInventoryItemForLabel } from "@/lib/matching/findInventoryMatchCandidates";
import { fetchDeliveryLabelAliasMap, fetchDeliveryLabelConversionHintsMap } from "@/lib/inventoryDeliveryLabelAliases";
import {
  computeDeliveryLineQtyReceived,
  type BlConversionInventoryHint,
} from "@/lib/receiving/blStockConversion";

type ParsedLine = {
  label: string;
  quantity: number;
  unit: string | null;
  packagingHint: string | null;
  blLineTotalHt: number | null;
  blUnitPriceStockHt: number | null;
};

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function parseNumericField(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/\u202f|\u00a0/g, " ").replace(/\s/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastComma > lastDot) {
    const intPart = s.slice(0, lastComma).replace(/\./g, "");
    const decPart = s.slice(lastComma + 1);
    const n = Number(`${intPart}.${decPart}`);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function looksLikeNonProductLine(label: string): boolean {
  const n = normalizeInventoryItemName(label);
  if (!n || n.length < 2) return true;
  if (
    /^(total|sous-total|sous total|total ht|total ttc|montant total|tva|t\.v\.a)(\s|$)/i.test(n)
  ) {
    return true;
  }
  return false;
}

/** Le modèle ne respecte pas toujours les noms de clés du prompt (designation vs label, etc.). */
function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = asString(o[k]);
    if (v) return v;
  }
  return null;
}

function pickNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = parseNumericField(o[k]);
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

/** Tableau de lignes : clés possibles selon les sorties du modèle. */
function linesArrayFromJson(json: Record<string, unknown>): unknown[] {
  const direct = [
    json.lines,
    json.Lines,
    json.lignes,
    json.items,
    json.products,
    json.articles,
    json.article_lines,
  ];
  for (const v of direct) {
    if (Array.isArray(v)) return v;
  }
  const data = json.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const nested = d.lines ?? d.items ?? d.lignes;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

/**
 * Si le modèle utilise des clés inconnues : préfère une chaîne contenant des lettres (libellé) aux seuls montants.
 */
function longestStringValueInRow(o: Record<string, unknown>): string | null {
  const candidates: string[] = [];
  for (const v of Object.values(o)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length >= 2) candidates.push(t);
  }
  const withLetters = candidates.filter((s) => /[\p{L}]/u.test(s));
  const pool = withLetters.length > 0 ? withLetters : candidates;
  let best = "";
  for (const t of pool) {
    if (t.length > best.length) best = t;
  }
  return best.length >= 2 ? best : null;
}

function parseLinesFromJson(json: Record<string, unknown>): ParsedLine[] {
  const raw = linesArrayFromJson(json);
  const out: ParsedLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    let label = pickString(o, [
      "label",
      "designation",
      "libelle",
      "libellé",
      "name",
      "description",
      "article",
      "produit",
      "libelle_article",
      "Désignation",
      "DESIGNATION",
    ]);
    if (!label) {
      label = longestStringValueInRow(o);
    }
    if (!label || looksLikeNonProductLine(label)) continue;
    const qty =
      pickNumber(o, [
        "quantity",
        "qty",
        "quantite",
        "quantité",
        "qte",
        "qté",
      ]) ?? 0;
    const unit = pickString(o, ["unit", "unite", "unité", "unite_commande"]);
    const packagingHint = pickString(o, [
      "packaging_hint",
      "packagingHint",
      "conditionnement",
      "conditionnement_hint",
    ]);
    const unitPrice = pickNumber(o, [
      "unit_price_ht",
      "prix_unitaire_ht",
      "pu_ht",
      "prix_u_ht",
      "unit_price",
      "prix_ht",
    ]);
    const lineTotal = pickNumber(o, [
      "line_total_ht",
      "montant_ht",
      "montant_ligne_ht",
      "total_ht",
      "total_ligne",
      "montant",
    ]);
    out.push({
      label,
      quantity: qty >= 0 ? qty : 0,
      unit,
      packagingHint,
      blLineTotalHt: lineTotal != null && lineTotal > 0 ? lineTotal : null,
      blUnitPriceStockHt: unitPrice != null && unitPrice > 0 ? unitPrice : null,
    });
  }
  return out;
}

export type BlExtractionResult =
  | { ok: true; insertedCount: number; rawLineCount: number; userMessage: string }
  | { ok: false; error: string };

function buildUserMessage(
  inserted: number,
  rawFromModel: number,
  sampleRowJson: string | null
): string {
  if (inserted > 0) {
    return `${inserted} ligne${inserted > 1 ? "s" : ""} ajoutée${inserted > 1 ? "s" : ""} à partir du BL. Vérifiez les quantités et prix avant validation.`;
  }
  if (rawFromModel === 0) {
    return `Aucune ligne renvoyée par l’IA (tableau vide ou illisible). Utilisez une photo nette, bien éclairée, avec le tableau des articles entier, ou saisissez les lignes à la main.`;
  }
  let msg = `L’IA a renvoyé ${rawFromModel} ligne(s), mais aucune n’a pu être importée (libellés vides ou filtrés comme totaux).`;
  if (sampleRowJson) {
    msg += ` Exemple de ligne reçue : ${sampleRowJson}`;
  }
  msg += " Essayez une autre photo ou la saisie manuelle.";
  return msg;
}

/**
 * Lit le BL (image) via OpenAI, remplace les lignes brouillon et tente de lier chaque ligne à un produit stock (nom identique normalisé).
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
  const outcome = await analyzeBlDocument(publicUrl, fileName);
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

  const json = outcome.json;
  const rawLineCount = linesArrayFromJson(json).length;
  const rawRows = linesArrayFromJson(json);
  let sampleRowJson: string | null = null;
  if (rawRows.length > 0 && rawRows[0] && typeof rawRows[0] === "object") {
    try {
      sampleRowJson = JSON.stringify(rawRows[0]).slice(0, 280);
    } catch {
      sampleRowJson = null;
    }
  }

  const supplier = asString(json.supplier_name_on_document);
  const docNum = asString(json.document_number);
  const deliveryDate = asString(json.delivery_date);
  const parsedLines = parseLinesFromJson(json);

  const userMessage = buildUserMessage(parsedLines.length, rawLineCount, sampleRowJson);

  const { data: invRows } = await supabaseServer
    .from("inventory_items")
    .select("id, name, unit, units_per_purchase")
    .eq("restaurant_id", restaurantId);

  const invItems = (invRows ?? []) as { id: string; name: string }[];

  const invById = new Map<string, BlConversionInventoryHint>(
    (invRows ?? []).map((r) => {
      const row = r as BlConversionInventoryHint;
      return [row.id, row];
    })
  );

  const [aliasMap, hintMap] = await Promise.all([
    fetchDeliveryLabelAliasMap(restaurantId, row.supplier_id),
    fetchDeliveryLabelConversionHintsMap(restaurantId, row.supplier_id),
  ]);

  const noteText = [
    supplier ? `Fournisseur (document) : ${supplier}.` : null,
    `Lecture BL (même pipeline que relevé v${BL_ANALYSIS_VERSION}).`,
    `Import : ${parsedLines.length} ligne(s) enregistrée(s).`,
    rawLineCount !== parsedLines.length
      ? `Côté modèle : ${rawLineCount} ligne(s) dans le JSON.`
      : null,
    userMessage,
  ]
    .filter(Boolean)
    .join(" ");

  const patch: Record<string, unknown> = {
    updated_at: now,
    notes: noteText,
  };
  if (docNum) patch.number = docNum;
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

  if (parsedLines.length === 0) {
    return {
      ok: true,
      insertedCount: 0,
      rawLineCount,
      userMessage,
    };
  }

  const rows = parsedLines.map((l, index) => {
    const inventoryItemId = matchInventoryItemForLabel(l.label, invItems, { aliasMap });
    const qtyDelivered = l.quantity;
    const qtyReceived = computeDeliveryLineQtyReceived({
      qtyDelivered,
      inventoryItemId,
      label: l.label,
      unit: l.unit,
      packagingHint: l.packagingHint,
      invById,
      hintMap,
    });
    return {
      delivery_note_id: deliveryNoteId,
      purchase_order_line_id: null,
      inventory_item_id: inventoryItemId,
      label: l.label,
      qty_ordered: 0,
      qty_delivered: qtyDelivered,
      qty_received: qtyReceived,
      unit: l.unit,
      sort_order: index,
      bl_line_total_ht: l.blLineTotalHt,
      bl_unit_price_stock_ht: l.blUnitPriceStockHt,
      manual_unit_price_stock_ht: null,
      supplier_invoice_extracted_line_id: null,
    };
  });

  const { error: insErr } = await supabaseServer.from("delivery_note_lines").insert(rows);
  if (insErr) {
    return { ok: false, error: insErr.message };
  }

  return {
    ok: true,
    insertedCount: parsedLines.length,
    rawLineCount,
    userMessage,
  };
}
