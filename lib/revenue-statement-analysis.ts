import OpenAI from "openai";
import sharp from "sharp";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 1800;
const JPEG_QUALITY = 80;

/** Une ligne extraite d’un relevé (plat, famille, code article…). */
export type RevenueStatementLine = {
  label: string;
  qty: number | null;
  amount_ttc: number | null;
  amount_ht: number | null;
  category: string | null;
  notes: string | null;
};

export type MonthlyRevenueSuggestion = {
  month: string;
  revenue_ttc: number | null;
  revenue_ht: number | null;
  label?: string | null;
  confidence?: "high" | "low" | "unreadable";
  notes?: string | null;
  /** Détail des ventes / rubriques si visible sur le document. */
  lines?: RevenueStatementLine[];
  /** Couverts ou équivalent si indiqué sur le relevé. */
  covers_estimate?: number | null;
  /** Nombre de tickets / commandes si visible. */
  ticket_count_estimate?: number | null;
};

export type RevenueStatementAnalysisResult = {
  suggestions: MonthlyRevenueSuggestion[];
  /** Commentaires sur tout le document (qualité photo, ambiguïtés). */
  document_notes?: string | null;
  error?: string;
};

const EXTRACTION_VERSION = 2 as const;

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
        ? EXTRACTION_VERSION
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

function parseOptionalQty(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim();
  const open = trimmed.indexOf("```");
  if (open === -1) return trimmed;
  const afterOpen = trimmed.slice(open + 3).replace(/^json\s*/i, "").trim();
  const close = afterOpen.indexOf("```");
  if (close === -1) return trimmed;
  return afterOpen.slice(0, close).trim();
}

function parseNumber(raw: unknown): number | null {
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

function normalizeMonth(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-01`;

  const numeric = s.match(/(\d{1,2})[\/.-](\d{4})/);
  if (numeric) {
    const month = Number(numeric[1]);
    const year = Number(numeric[2]);
    if (month >= 1 && month <= 12 && year >= 2000) return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  const lower = s.toLocaleLowerCase("fr");
  const months = [
    "janvier",
    "février",
    "fevrier",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "aout",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
    "decembre",
  ];
  const year = lower.match(/20\d{2}/)?.[0];
  if (!year) return null;
  const idx = months.findIndex((m) => lower.includes(m));
  if (idx === -1) return null;
  const monthNumber = idx >= 2 ? idx : idx + 1;
  const adjusted =
    lower.includes("février") || lower.includes("fevrier")
      ? 2
      : lower.includes("août") || lower.includes("aout")
        ? 8
        : lower.includes("décembre") || lower.includes("decembre")
          ? 12
          : monthNumber;
  return `${year}-${String(adjusted).padStart(2, "0")}-01`;
}

function normalizeLinesFromOpenAiRow(r: Record<string, unknown>): RevenueStatementLine[] {
  const raw = r.lines;
  if (!Array.isArray(raw)) return [];
  const lines: RevenueStatementLine[] = [];
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
  return lines;
}

function normalizeSuggestions(json: unknown): MonthlyRevenueSuggestion[] {
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  const rawRows = Array.isArray(obj.months)
    ? obj.months
    : Array.isArray(obj.items)
      ? obj.items
      : Array.isArray(obj.rows)
        ? obj.rows
        : [];
  const out: MonthlyRevenueSuggestion[] = [];
  for (const row of rawRows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const month = normalizeMonth(r.month ?? r.period ?? r.periode ?? r.date);
    if (!month) continue;
    const lines = normalizeLinesFromOpenAiRow(r);
    out.push({
      month,
      revenue_ttc: parseNumber(r.revenue_ttc ?? r.ca_ttc ?? r.turnover_ttc ?? r.amount_ttc ?? r.ca),
      revenue_ht: parseNumber(r.revenue_ht ?? r.ca_ht ?? r.turnover_ht ?? r.amount_ht),
      label: typeof r.label === "string" ? r.label.trim() : null,
      confidence:
        r.confidence === "high" || r.confidence === "low" || r.confidence === "unreadable"
          ? r.confidence
          : "low",
      notes: typeof r.notes === "string" ? r.notes.trim() : null,
      lines: lines.length > 0 ? lines : undefined,
      covers_estimate: parseOptionalQty(r.covers_estimate ?? r.covers),
      ticket_count_estimate: parseOptionalQty(r.ticket_count_estimate ?? r.tickets ?? r.ticket_count),
    });
  }
  return out.filter(
    (row) =>
      row.revenue_ttc != null ||
      row.revenue_ht != null ||
      (Array.isArray(row.lines) && row.lines.length > 0)
  );
}

function extractDocumentNotes(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  return typeof o.document_notes === "string" ? o.document_notes.trim() || null : null;
}

async function bufferToJpegDataUrl(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

const SYSTEM_PROMPT_CA = `Réponds uniquement en JSON valide UTF-8.

Tu analyses des photos de relevés de chiffre d'affaires : exports logiciel de caisse, tableaux Excel imprimés, captures d'écran POS, récapitulatifs mensuels, tickets Z agrégés, etc.

Schéma JSON attendu :
{
  "document_notes": string|null,
  "months": [
    {
      "month": "YYYY-MM",
      "revenue_ttc": number|null,
      "revenue_ht": number|null,
      "label": string|null,
      "confidence": "high"|"low"|"unreadable",
      "notes": string|null,
      "covers_estimate": number|null,
      "ticket_count_estimate": number|null,
      "lines": [
        {
          "label": "libellé (plat, famille, code, rubrique vente)",
          "qty": number|null,
          "amount_ttc": number|null,
          "amount_ht": number|null,
          "category": string|null,
          "notes": string|null
        }
      ]
    }
  ]
}

Règles importantes :
- Extrais le MAXIMUM d'informations visibles : si un tableau liste des plats, familles, codes ou montants par ligne, remplis "lines" avec une entrée par ligne lisible.
- Si le document regroupe par rubrique / famille / TVA, renseigne "category" sur chaque ligne ou des libellés explicites dans "label".
- Si des quantités ou montants HT/TTC par ligne sont présents, renseigne-les ; sinon null.
- Renseigne "covers_estimate" ou "ticket_count_estimate" seulement s'ils sont indiqués sur le document.
- Pour chaque période mensuelle claire, crée une entrée dans "months" avec "month" au format YYYY-MM.
- Si tu ne peux extraire qu'un total mensuel sans détail, "lines" peut être [].
- N'invente pas de chiffres : null si illisible ou absent.
- Montants en euros ; nombres JSON avec point décimal.
- "document_notes" : qualité de l'image, ce qui manque, ambiguïtés (une phrase courte).`;

const USER_PROMPT_CA = `Analyse cette image de relevé de CA. Extrais les totaux par mois ET tout détail de ventes (lignes plats / rubriques / montants) lisible sur le document. Si un seul total est visible sans précision HT/TTC, mets-le dans revenue_ttc et précise l'incertitude dans notes.`;

/** Version du schéma d'extraction stocké dans analysis_result_json. */
export const REVENUE_EXTRACTION_VERSION = EXTRACTION_VERSION;

export async function analyzeRevenueStatementImageFromBuffer(
  buffer: Buffer
): Promise<RevenueStatementAnalysisResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { suggestions: [], error: "OPENAI_API_KEY missing" };
  }

  try {
    const imageUrl = await bufferToJpegDataUrl(buffer);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT_CA,
        },
        {
          role: "user",
          content: USER_PROMPT_CA,
        },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: imageUrl, detail: "high" as const } }],
        },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return { suggestions: [], error: "Réponse vide du modèle." };
    const parsed = JSON.parse(stripMarkdownCodeBlock(raw)) as unknown;
    const document_notes = extractDocumentNotes(parsed);
    const suggestions = normalizeSuggestions(parsed);
    return { suggestions, document_notes };
  } catch (e) {
    return { suggestions: [], error: e instanceof Error ? e.message : "Analyse CA impossible." };
  }
}
