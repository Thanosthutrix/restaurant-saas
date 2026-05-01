import OpenAI from "openai";
import sharp from "sharp";

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
};

export type RevenueStatementAnalysisResult = {
  suggestions: MonthlyRevenueSuggestion[];
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
    });
  }
  return out.filter((row) => row.revenue_ttc != null || row.revenue_ht != null);
}

async function bufferToJpegDataUrl(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

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
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Réponds uniquement en JSON valide. Extrait l'historique de chiffre d'affaires mensuel. Format: {\"months\":[{\"month\":\"YYYY-MM\",\"revenue_ttc\":number|null,\"revenue_ht\":number|null,\"label\":string|null,\"confidence\":\"high\"|\"low\"|\"unreadable\",\"notes\":string|null}]}. N'invente pas de mois ni de montants.",
        },
        {
          role: "user",
          content:
            "Analyse ce relevé de chiffre d'affaires ou export mensuel. Extrais uniquement les mois lisibles et les montants de CA HT/TTC. Si un seul montant est visible sans précision HT/TTC, mets-le dans revenue_ttc et indique l'incertitude en notes.",
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
    return { suggestions: normalizeSuggestions(parsed) };
  } catch (e) {
    return { suggestions: [], error: e instanceof Error ? e.message : "Analyse CA impossible." };
  }
}
