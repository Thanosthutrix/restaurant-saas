/**
 * Lecture de `analysis_result_json` (relevés CA) — sans dépendance Node lourde.
 * Importable depuis les composants client (évite sharp / child_process).
 */

export type RevenueStatementLine = {
  label: string;
  qty: number | null;
  amount_ttc: number | null;
  amount_ht: number | null;
  category: string | null;
  notes: string | null;
};

/** Version du schéma d’extraction (stockée côté DB / prompts). */
export const REVENUE_EXTRACTION_VERSION = 2 as const;

export function parseOptionalQty(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

export function parseNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw * 100) / 100;
  }
  const s = String(raw)
    .trim()
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/\s/g, "")
    .replace(/€/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let n: number;
  if (lastComma !== -1 && lastComma > lastDot) {
    n = Number(`${s.slice(0, lastComma).replace(/\./g, "")}.${s.slice(lastComma + 1)}`);
  } else {
    n = Number(s.replace(/,/g, ""));
  }
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function parseAnalysisResultJson(json: unknown): {
  lines: RevenueStatementLine[];
  covers_estimate: number | null;
  ticket_count_estimate: number | null;
  document_notes: string | null;
  extraction_version: number;
} {
  if (!json || typeof json !== "object") {
    return {
      lines: [],
      covers_estimate: null,
      ticket_count_estimate: null,
      document_notes: null,
      extraction_version: 1,
    };
  }
  const o = json as Record<string, unknown>;
  const lines: RevenueStatementLine[] = [];
  const raw = o.lines;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const L = item as Record<string, unknown>;
      const label = typeof L.label === "string" ? L.label.trim() : "";
      if (!label) continue;
      lines.push({
        label,
        qty: parseOptionalQty(L.qty ?? L.quantity ?? L.qte),
        amount_ttc: parseNumber(L.amount_ttc ?? L.montant_ttc ?? L.total_ttc),
        amount_ht: parseNumber(L.amount_ht ?? L.montant_ht ?? L.total_ht),
        category:
          typeof L.category === "string"
            ? L.category.trim() || null
            : typeof L.rubrique === "string"
              ? L.rubrique.trim() || null
              : typeof L.famille === "string"
                ? L.famille.trim() || null
                : null,
        notes: typeof L.notes === "string" ? L.notes.trim() || null : null,
      });
    }
  }

  const cov = o.covers_estimate ?? o.covers;
  const tickets = o.ticket_count_estimate ?? o.tickets ?? o.ticket_count;
  const document_notes = typeof o.document_notes === "string" ? o.document_notes.trim() || null : null;
  const extraction_version =
    typeof o.extraction_version === "number" && Number.isFinite(o.extraction_version)
      ? o.extraction_version
      : lines.length > 0 || document_notes
        ? REVENUE_EXTRACTION_VERSION
        : 1;

  return {
    lines,
    covers_estimate: parseOptionalQty(cov),
    ticket_count_estimate: parseOptionalQty(tickets),
    document_notes,
    extraction_version,
  };
}

/** Indique si l’import photo contient du détail exploitable en UI. */
export function hasImportedRevenueDetail(json: unknown): boolean {
  const p = parseAnalysisResultJson(json);
  return (
    p.lines.length > 0 ||
    p.covers_estimate != null ||
    p.ticket_count_estimate != null ||
    (p.document_notes != null && p.document_notes.length > 0)
  );
}

/**
 * Montant utilisé pour les barres (cohérent avec la valorisation app en priorité HT).
 * Si le relevé n’a que du TTC sur une ligne, on retombe sur le TTC.
 */
export function extractedLineRevenueAmount(line: RevenueStatementLine): number {
  const ht = line.amount_ht;
  const ttc = line.amount_ttc;
  if (ht != null && Number.isFinite(ht) && ht >= 0) return ht;
  if (ttc != null && Number.isFinite(ttc) && ttc >= 0) return ttc;
  return 0;
}

export function hasExtractedLineAmounts(lines: RevenueStatementLine[]): boolean {
  return lines.some((l) => extractedLineRevenueAmount(l) > 0);
}

export type ExtractedChartAggregate = {
  key: string;
  revenue: number;
  qty: number;
};

function bump(
  map: Map<string, { revenue: number; qty: number }>,
  key: string,
  revenue: number,
  qty: number | null
) {
  const cur = map.get(key) ?? { revenue: 0, qty: 0 };
  cur.revenue += revenue;
  if (qty != null && Number.isFinite(qty) && qty > 0) cur.qty += qty;
  map.set(key, cur);
}

function rootFromCategory(category: string | null): string {
  const c = category?.trim() || "";
  if (!c) return "Sans rubrique";
  const sep = " › ";
  const i = c.indexOf(sep);
  return i === -1 ? c : c.slice(0, i).trim() || "Sans rubrique";
}

function toSortedAggregates(map: Map<string, { revenue: number; qty: number }>): ExtractedChartAggregate[] {
  return [...map.entries()]
    .map(([key, v]) => ({ key, revenue: v.revenue, qty: v.qty }))
    .filter((a) => a.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

/** Grandes familles : premier segment de la rubrique extraite (comme l’arborescence carte). */
export function buildExtractedRootAggregates(lines: RevenueStatementLine[]): ExtractedChartAggregate[] {
  const map = new Map<string, { revenue: number; qty: number }>();
  for (const line of lines) {
    const amt = extractedLineRevenueAmount(line);
    if (amt <= 0) continue;
    bump(map, rootFromCategory(line.category), amt, line.qty);
  }
  return toSortedAggregates(map);
}

/** Rubrique complète telle qu’extraite, ou libellé seul si pas de rubrique. */
export function buildExtractedDetailAggregates(lines: RevenueStatementLine[]): ExtractedChartAggregate[] {
  const map = new Map<string, { revenue: number; qty: number }>();
  for (const line of lines) {
    const amt = extractedLineRevenueAmount(line);
    if (amt <= 0) continue;
    const key = line.category?.trim() || line.label;
    bump(map, key, amt, line.qty);
  }
  return toSortedAggregates(map);
}

/** Top libellés (lignes relevé), montants cumulés si doublons. */
export function buildExtractedTopByLabel(lines: RevenueStatementLine[], limit: number): ExtractedChartAggregate[] {
  const map = new Map<string, { revenue: number; qty: number }>();
  for (const line of lines) {
    const amt = extractedLineRevenueAmount(line);
    if (amt <= 0) continue;
    bump(map, line.label, amt, line.qty);
  }
  return toSortedAggregates(map).slice(0, Math.max(0, limit));
}
