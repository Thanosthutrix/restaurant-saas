import { matchInventoryItemForLabel } from "@/lib/matching/findInventoryMatchCandidates";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";
import {
  computeDeliveryLineQtyReceived,
  type BlConversionInventoryHint,
  type SavedBlConversionHint,
} from "@/lib/receiving/blStockConversion";

export type ParsedDeliveryLine = {
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
export function looksLikeNonProductLine(label: string): boolean {
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
export function coherenceNoteForLines(lines: ParsedDeliveryLine[]): string | null {
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

export function parseExtractionConfidence(v: unknown): "high" | "low" | "unreadable" {
  if (v === "high" || v === "low" || v === "unreadable") return v;
  return "unreadable";
}

function labelDedupKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Même libellé répété sur 3+ lignes : très suspect (ex. phrase inventée sur toutes les lignes).
 */
export function looksLikeRepeatedLabelHallucination(lines: ParsedDeliveryLine[]): boolean {
  if (lines.length < 3) return false;
  const keys = lines.map((l) => labelDedupKey(l.label));
  const first = keys[0];
  if (!first) return false;
  return keys.every((k) => k === first);
}

export function parseLinesFromDeliveryNoteJson(json: Record<string, unknown>): ParsedDeliveryLine[] {
  const raw = json.lines;
  if (!Array.isArray(raw)) return [];
  const out: ParsedDeliveryLine[] = [];
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
    const packagingHint = firstString(o, ["packaging_hint", "packagingHint", "conditionnement"]);
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
      packagingHint,
      blLineTotalHt: lineTotal != null && lineTotal > 0 ? lineTotal : null,
      blUnitPriceStockHt: unitPrice != null && unitPrice > 0 ? unitPrice : null,
    });
  }
  return out;
}

/** Prépare les lignes à insérer avec rattachement stock et conversion quantités. */
export function buildDeliveryNoteLineRows(
  deliveryNoteId: string,
  parsedLines: ParsedDeliveryLine[],
  invItems: { id: string; name: string }[],
  invById: Map<string, BlConversionInventoryHint>,
  aliasMap: Map<string, string>,
  hintMap: Map<string, SavedBlConversionHint>
) {
  return parsedLines.map((l, index) => {
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
}
