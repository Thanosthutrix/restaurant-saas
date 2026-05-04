import OpenAI from "openai";
import sharp from "sharp";
import { isPdfBuffer } from "@/lib/isPdfBuffer";
import type { RevenueStatementLine } from "./revenue-statement-analysisJson";
import { parseNumber, parseOptionalQty } from "./revenue-statement-analysisJson";

export type { RevenueStatementLine } from "./revenue-statement-analysisJson";
export { REVENUE_EXTRACTION_VERSION } from "./revenue-statement-analysisJson";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 1800;
const JPEG_QUALITY = 80;

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

function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim();
  const open = trimmed.indexOf("```");
  if (open === -1) return trimmed;
  const afterOpen = trimmed.slice(open + 3).replace(/^json\s*/i, "").trim();
  const close = afterOpen.indexOf("```");
  if (close === -1) return trimmed;
  return afterOpen.slice(0, close).trim();
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

const USER_PROMPT_CA_DOCUMENT = `Analyse ce relevé de CA (document ci-joint : capture, scan ou PDF exporté). Extrais les totaux par mois ET tout détail de ventes (lignes plats / rubriques / montants) lisible sur le document. Si un seul total est visible sans précision HT/TTC, mets-le dans revenue_ttc et précise l'incertitude dans notes.`;

function extractJsonObject(text: string): string | null {
  const trimmed = stripMarkdownCodeBlock(text).trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function parseRevenueModelOutput(raw: string | null | undefined): RevenueStatementAnalysisResult {
  if (!raw) return { suggestions: [], error: "Réponse vide du modèle." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownCodeBlock(raw)) as unknown;
  } catch {
    const obj = extractJsonObject(raw);
    if (!obj) return { suggestions: [], error: "Réponse du modèle invalide (JSON)." };
    try {
      parsed = JSON.parse(obj) as unknown;
    } catch (e) {
      return { suggestions: [], error: e instanceof Error ? e.message : "JSON invalide." };
    }
  }
  const document_notes = extractDocumentNotes(parsed);
  const suggestions = normalizeSuggestions(parsed);
  return { suggestions, document_notes };
}

export async function analyzeRevenueStatementImageFromBuffer(
  buffer: Buffer
): Promise<RevenueStatementAnalysisResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { suggestions: [], error: "OPENAI_API_KEY missing" };
  }

  try {
    if (isPdfBuffer(buffer)) {
      const fileData = `data:application/pdf;base64,${buffer.toString("base64")}`;
      const combinedText = `${SYSTEM_PROMPT_CA}\n\n${USER_PROMPT_CA_DOCUMENT}`;
      const response = await openai.responses.create({
        model: "gpt-4o",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: combinedText },
              { type: "input_file", filename: "releve-ca.pdf", file_data: fileData },
            ],
          },
        ],
      });
      return parseRevenueModelOutput(response.output_text);
    }

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
    return parseRevenueModelOutput(response.choices[0]?.message?.content);
  } catch (e) {
    return { suggestions: [], error: e instanceof Error ? e.message : "Analyse CA impossible." };
  }
}
