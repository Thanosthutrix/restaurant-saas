import { supabaseServer } from "@/lib/supabaseServer";
import {
  analyzeDeliveryNoteDocument,
  DELIVERY_NOTE_ANALYSIS_VERSION,
} from "@/lib/delivery-note-openai";
import { getDeliveryNoteFileUrl } from "@/lib/db";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import { matchInventoryItemForLabel } from "@/lib/matching/findInventoryMatchCandidates";
import { fetchDeliveryLabelAliasMap } from "@/lib/inventoryDeliveryLabelAliases";

type ParsedLine = {
  label: string;
  quantity: number;
  unit: string | null;
  blLineTotalHt: number | null;
  blUnitPriceStockHt: number | null;
};

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** Parse quantités / montants (nombre JSON, ou chaîne FR : 1 234,56 / 12,5 / 1.234,56). */
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

function firstString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = asString(o[k]);
    if (v) return v;
  }
  return null;
}

function firstNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = parseNumericField(o[k]);
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

/** Exclut surtout les lignes de totaux globaux, pas les articles. */
function looksLikeNonProductLine(label: string): boolean {
  const n = normalizeInventoryItemName(label);
  if (!n || n.length < 2) return true;
  if (
    /^(total|sous-total|sous total|total ht|total ttc|total hors|montant total|tva|t\.v\.a)(\s|$)/i.test(n)
  ) {
    return true;
  }
  return false;
}

/** Alerte si PU×Qté et montant HT ligne divergent trop (erreur de lecture fréquente). */
function coherenceNoteForLines(lines: ParsedLine[]): string | null {
  const snippets: string[] = [];
  for (const line of lines) {
    const q = line.quantity;
    const pu = line.blUnitPriceStockHt;
    const tot = line.blLineTotalHt;
    if (q > 0 && pu != null && pu > 0 && tot != null && tot > 0) {
      const expected = q * pu;
      const diff = Math.abs(expected - tot);
      const tol = Math.max(0.03 * tot, 0.05);
      if (diff > tol) {
        const short = line.label.length > 52 ? `${line.label.slice(0, 52)}…` : line.label;
        snippets.push(`${short} (PU×Qté ≈ ${expected.toFixed(2)} ≠ ${tot.toFixed(2)} HT)`);
      }
    }
  }
  if (snippets.length === 0) return null;
  const head = snippets.slice(0, 2).join(" ; ");
  const extra = snippets.length > 2 ? ` ; +${snippets.length - 2} autre(s)` : "";
  return `Contrôle auto : vérifiez PU / quantité / montant HT — ${head}${extra}.`;
}

function parseExtractionConfidence(v: unknown): "high" | "low" | "unreadable" {
  if (v === "high" || v === "low" || v === "unreadable") return v;
  return "unreadable";
}

function labelDedupKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Même libellé répété sur 3+ lignes : très suspect (ex. phrase inventée du type « danone liquide… » sur toutes les lignes).
 * Un vrai BL liste en général des désignations différentes.
 */
function looksLikeRepeatedLabelHallucination(lines: ParsedLine[]): boolean {
  if (lines.length < 3) return false;
  const keys = lines.map((l) => labelDedupKey(l.label));
  const first = keys[0];
  if (!first) return false;
  return keys.every((k) => k === first);
}

function parseLinesFromJson(json: Record<string, unknown>): ParsedLine[] {
  const raw = json.lines;
  if (!Array.isArray(raw)) return [];
  const out: ParsedLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const label = firstString(o, [
      "label",
      "designation",
      "libelle",
      "libellé",
      "article",
      "produit",
      "description",
    ]);
    if (!label || looksLikeNonProductLine(label)) continue;

    const qty =
      firstNumber(o, ["quantity", "qty", "quantite", "quantité", "qte", "qté"]) ?? 0;
    const unit = firstString(o, ["unit", "unite", "unité", "unite_commande"]);
    const unitPrice = firstNumber(o, [
      "unit_price_ht",
      "prix_unitaire_ht",
      "pu_ht",
      "prix_u_ht",
      "prix_ht",
      "unit_price",
    ]);
    const lineTotal = firstNumber(o, [
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
      blLineTotalHt: lineTotal != null && lineTotal > 0 ? lineTotal : null,
      blUnitPriceStockHt: unitPrice != null && unitPrice > 0 ? unitPrice : null,
    });
  }
  return out;
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
  const parsedLines = parseLinesFromJson(json);

  const { data: invRows } = await supabaseServer
    .from("inventory_items")
    .select("id, name")
    .eq("restaurant_id", restaurantId);

  const invItems = (invRows ?? []) as { id: string; name: string }[];

  const aliasMap = await fetchDeliveryLabelAliasMap(restaurantId, row.supplier_id);

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

  const rows = parsedLines.map((l, index) => {
    const inventoryItemId = matchInventoryItemForLabel(l.label, invItems, { aliasMap });
    const qtyD = l.quantity;
    const qtyR = qtyD;
    return {
      delivery_note_id: deliveryNoteId,
      purchase_order_line_id: null,
      inventory_item_id: inventoryItemId,
      label: l.label,
      qty_ordered: 0,
      qty_delivered: qtyD,
      qty_received: qtyR,
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

  return { ok: true };
}
