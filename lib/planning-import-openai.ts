import OpenAI from "openai";
import sharp from "sharp";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  collectPlanningImportEntries,
  countDistinctDatesInParsed,
  type PlanningImportEntry,
} from "@/lib/staff/planningImportApply";
import { addDays, mondayOfWeekContaining, parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 2400;
const JPEG_QUALITY = 82;
const planningModel = () => process.env.OPENAI_PLANNING_MODEL?.trim() || "gpt-4o-2024-08-06";

function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim();
  const open = trimmed.indexOf("```");
  if (open === -1) return trimmed;
  const afterOpen = trimmed.slice(open + 3).replace(/^json\s*/i, "").trim();
  const close = afterOpen.indexOf("```");
  if (close === -1) return trimmed;
  return afterOpen.slice(0, close).trim();
}

function extractJsonObject(text: string): string | null {
  const trimmed = stripMarkdownCodeBlock(text).trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function removeTrailingCommas(json: string): string {
  let prev = json;
  let next = prev.replace(/,\s*(\]|\})/g, "$1");
  while (next !== prev) {
    prev = next;
    next = prev.replace(/,\s*(\]|\})/g, "$1");
  }
  return next;
}

function closeOpenBrackets(s: string): string {
  let inString = false;
  let escape = false;
  const stack: ("{" | "[")[] = [];
  for (const ch of s) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") stack.push("{");
    else if (ch === "[") stack.push("[");
    else if (ch === "}" && stack.length) stack.pop();
    else if (ch === "]" && stack.length) stack.pop();
  }
  let suffix = "";
  for (let i = stack.length - 1; i >= 0; i--) {
    suffix += stack[i] === "[" ? "]" : "}";
  }
  return s + suffix;
}

function truncateToLastCompleteDayBlock(json: string): string | null {
  const marker = '"date"';
  let lastComplete = -1;
  let searchFrom = 0;
  while (true) {
    const idx = json.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const dayStart = json.lastIndexOf("{", idx);
    if (dayStart === -1) {
      searchFrom = idx + marker.length;
      continue;
    }
    let depth = 0;
    let inString = false;
    let escape = false;
    let dayEnd = -1;
    for (let i = dayStart; i < json.length; i++) {
      const ch = json[i]!;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\" && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          dayEnd = i;
          break;
        }
      }
    }
    if (dayEnd > dayStart) lastComplete = dayEnd;
    searchFrom = idx + marker.length;
  }
  if (lastComplete <= 0) return null;
  const slice = json.slice(0, lastComplete + 1);
  return removeTrailingCommas(closeOpenBrackets(slice));
}

function tryParseObject(json: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function parsePlanningModelOutput(raw: string | null | undefined): { json: Record<string, unknown> } | { error: string } {
  if (!raw?.trim()) return { error: "Réponse vide du modèle." };

  const extracted = extractJsonObject(raw);
  const candidates = [
    stripMarkdownCodeBlock(raw),
    extracted,
    extracted ? removeTrailingCommas(extracted) : null,
    extracted ? truncateToLastCompleteDayBlock(extracted) : null,
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    const parsed = tryParseObject(candidate);
    if (parsed) return { json: parsed };
  }

  if (extracted) {
    for (let i = extracted.length; i > 200; i -= 1) {
      const ch = extracted[i - 1];
      if (ch !== "}" && ch !== "]") continue;
      const slice = extracted.slice(0, i);
      const repaired = removeTrailingCommas(closeOpenBrackets(slice));
      const parsed = tryParseObject(repaired);
      if (parsed && (Array.isArray(parsed.planning) || Array.isArray(parsed.entries))) {
        return { json: parsed };
      }
    }
  }

  return {
    error:
      "Réponse du modèle invalide (JSON tronqué ou mal formé). Essayez un PDF exporté, une photo plus nette, ou un document plus court.",
  };
}

function buildPlanningImportPrompt(params: {
  referenceWeekMondayYmd: string;
  staffNames: string[];
}): string {
  const staffList = params.staffNames.map((n) => `- ${n}`).join("\n");
  return `
Tu lis un document de planning d'équipe pour un restaurant (photo, scan, PDF, capture Excel…).
Le document peut couvrir **un mois entier** (4–5 semaines) : extrais **toutes** les dates visibles.

**JSON strict** : un seul objet, sans markdown. Pas de virgule finale. Format **compact** obligatoire :

{
  "period_start": "AAAA-MM-JJ",
  "period_end": "AAAA-MM-JJ",
  "entries": [
    {"d":"AAAA-MM-JJ","n":"Prénom Nom","s":"11:00","e":"15:00","b":0}
  ],
  "unmatched_names": [],
  "notes": null,
  "rationale_short": "synthèse"
}

- d = date, n = nom exact (liste ci-dessous), s/e = HH:mm Europe/Paris, b = break_minutes (0 si inconnu).
- **Ne regroupe pas par semaine** : une entrée par créneau, toutes les dates du document.
- Référence si mois absent du document : semaine du ${params.referenceWeekMondayYmd}.

Collaborateurs :
${staffList}
`.trim();
}

function buildPlanningWeekChunkPrompt(params: {
  dateFrom: string;
  dateTo: string;
  staffNames: string[];
}): string {
  const staffList = params.staffNames.map((n) => `- ${n}`).join("\n");
  return `
Tu lis un document de planning (PDF ou image). Extrais **uniquement** les créneaux dont la date est entre **${params.dateFrom}** et **${params.dateTo}** (inclus).
Ignore les autres dates même si visibles sur le document.

JSON strict, format compact :
{
  "period_start": "${params.dateFrom}",
  "period_end": "${params.dateTo}",
  "entries": [{"d":"AAAA-MM-JJ","n":"Prénom Nom","s":"11:00","e":"15:00","b":0}],
  "unmatched_names": [],
  "notes": null
}

Collaborateurs (noms exacts pour "n") :
${staffList}
`.trim();
}

function monthBoundsFromReference(refYmd: string): { start: string; end: string } {
  const d = parseISODateLocal(refYmd);
  if (!d) return { start: refYmd, end: refYmd };
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toISODateString(start), end: toISODateString(end) };
}

function daysBetweenInclusive(startYmd: string, endYmd: string): number {
  const a = parseISODateLocal(startYmd);
  const b = parseISODateLocal(endYmd);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
}

function weekRangesInPeriod(periodStart: string, periodEnd: string): { from: string; to: string }[] {
  const start = parseISODateLocal(periodStart);
  const end = parseISODateLocal(periodEnd);
  if (!start || !end) return [];

  let monday = mondayOfWeekContaining(start);
  const ranges: { from: string; to: string }[] = [];

  while (monday <= end) {
    const weekEnd = addDays(monday, 6);
    const from = monday < start ? start : monday;
    const to = weekEnd > end ? end : weekEnd;
    ranges.push({ from: toISODateString(from), to: toISODateString(to) });
    monday = addDays(monday, 7);
  }
  return ranges;
}

function mergePlanningChunks(chunks: Record<string, unknown>[]): Record<string, unknown> {
  const byKey = new Map<string, PlanningImportEntry>();
  const unmatched = new Set<string>();
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  const notes: string[] = [];

  for (const chunk of chunks) {
    const ps = typeof chunk.period_start === "string" ? chunk.period_start.slice(0, 10) : null;
    const pe = typeof chunk.period_end === "string" ? chunk.period_end.slice(0, 10) : null;
    if (ps && (!periodStart || ps < periodStart)) periodStart = ps;
    if (pe && (!periodEnd || pe > periodEnd)) periodEnd = pe;

    if (Array.isArray(chunk.unmatched_names)) {
      for (const n of chunk.unmatched_names) {
        if (typeof n === "string" && n.trim()) unmatched.add(n.trim());
      }
    }
    if (typeof chunk.notes === "string" && chunk.notes.trim()) notes.push(chunk.notes.trim());

    for (const entry of collectPlanningImportEntries(chunk)) {
      const key = `${entry.d}|${entry.n}|${entry.s}|${entry.e}`;
      byKey.set(key, entry);
    }
  }

  const entries = [...byKey.values()].sort((a, b) => a.d.localeCompare(b.d) || a.n.localeCompare(b.n));

  return {
    period_start: periodStart,
    period_end: periodEnd,
    entries,
    unmatched_names: [...unmatched],
    notes: notes.length > 0 ? notes.join(" ") : null,
    rationale_short: `Import fusionné : ${entries.length} créneaux sur ${new Set(entries.map((e) => e.d)).size} jours.`,
  };
}

function needsWeeklyChunking(parsed: Record<string, unknown>, referenceWeekMondayYmd: string): boolean {
  const distinct = countDistinctDatesInParsed(parsed);
  const ps = typeof parsed.period_start === "string" ? parsed.period_start.slice(0, 10) : null;
  const pe = typeof parsed.period_end === "string" ? parsed.period_end.slice(0, 10) : null;
  const month = monthBoundsFromReference(referenceWeekMondayYmd);

  const periodStart = ps ?? month.start;
  const periodEnd = pe ?? month.end;
  const spanDays = daysBetweenInclusive(periodStart, periodEnd);

  if (spanDays <= 7) return false;
  if (distinct >= Math.max(14, Math.floor(spanDays * 0.5))) return false;
  if (distinct <= 8 && spanDays >= 14) return true;
  return distinct < Math.floor(spanDays * 0.35);
}

export type PlanningImportOpenAiOutcome =
  | { kind: "success"; json: Record<string, unknown> }
  | { kind: "error"; message: string }
  | { kind: "skipped_no_key"; message: string };

async function analyzeFromBuffer(
  buffer: Buffer,
  fileName: string,
  prompt: string
): Promise<PlanningImportOpenAiOutcome> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { kind: "skipped_no_key", message: "OPENAI_API_KEY manquante : import IA désactivé." };
  }

  if (isPdfFileName(fileName)) {
    try {
      const fileData = `data:application/pdf;base64,${buffer.toString("base64")}`;
      const input = [
        {
          role: "user" as const,
          content: [
            { type: "input_text" as const, text: prompt },
            { type: "input_file" as const, filename: fileName || "planning.pdf", file_data: fileData },
          ],
        },
      ];

      let raw: string | null | undefined;
      try {
        const response = await openai.responses.create({
          model: "gpt-4o",
          max_output_tokens: 16384,
          text: { format: { type: "json_object" } },
          input,
        });
        raw = response.output_text;
      } catch (formatErr) {
        console.warn("[planning-import-openai:pdf] json_object non supporté, repli sans format", formatErr);
        const response = await openai.responses.create({
          model: "gpt-4o",
          max_output_tokens: 16384,
          input,
        });
        raw = response.output_text;
      }

      const parsed = parsePlanningModelOutput(raw);
      if ("error" in parsed) return { kind: "error", message: parsed.error };
      return { kind: "success", json: parsed.json };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec analyse PDF";
      console.error("[planning-import-openai:pdf]", e);
      return { kind: "error", message: msg };
    }
  }

  if (!isLikelyImageFileName(fileName)) {
    return {
      kind: "error",
      message: "Format non reconnu. Utilisez une photo (JPG, PNG…) ou un PDF.",
    };
  }

  try {
    const imageBase64 = await preprocessImageBuffer(buffer);
    const response = await openai.chat.completions.create({
      model: planningModel(),
      temperature: 0.1,
      max_completion_tokens: 16384,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrais le planning de ce document." },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
    });
    const parsed = parsePlanningModelOutput(response.choices[0]?.message?.content);
    if ("error" in parsed) return { kind: "error", message: parsed.error };
    return { kind: "success", json: parsed.json };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec analyse image";
    console.error("[planning-import-openai:image]", e);
    return { kind: "error", message: msg };
  }
}

function isPdfFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isLikelyImageFileName(name: string): boolean {
  const n = name.toLowerCase();
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/.test(n);
}

async function preprocessImageBuffer(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

export async function analyzePlanningDocumentFromStorage(params: {
  bucket: string;
  path: string;
  fileName: string;
  weekMondayYmd: string;
  staffNames: string[];
}): Promise<PlanningImportOpenAiOutcome> {
  const { data, error: dlErr } = await supabaseServer.storage.from(params.bucket).download(params.path);
  if (dlErr) return { kind: "error", message: dlErr.message };
  if (!data) return { kind: "error", message: "Fichier introuvable dans le stockage." };

  const buffer = Buffer.from(await data.arrayBuffer());
  const prompt = buildPlanningImportPrompt({
    referenceWeekMondayYmd: params.weekMondayYmd,
    staffNames: params.staffNames,
  });

  const first = await analyzeFromBuffer(buffer, params.fileName, prompt);
  if (first.kind !== "success") return first;

  if (!needsWeeklyChunking(first.json, params.weekMondayYmd)) {
    return first;
  }

  console.log("[planning-import] couverture partielle — extraction par semaine");

  const month = monthBoundsFromReference(params.weekMondayYmd);
  const ps =
    typeof first.json.period_start === "string" ? first.json.period_start.slice(0, 10) : month.start;
  const pe = typeof first.json.period_end === "string" ? first.json.period_end.slice(0, 10) : month.end;
  const ranges = weekRangesInPeriod(ps, pe);

  const chunks: Record<string, unknown>[] = [first.json];

  for (const range of ranges) {
    const chunkPrompt = buildPlanningWeekChunkPrompt({
      dateFrom: range.from,
      dateTo: range.to,
      staffNames: params.staffNames,
    });
    const chunk = await analyzeFromBuffer(buffer, params.fileName, chunkPrompt);
    if (chunk.kind === "success") chunks.push(chunk.json);
  }

  return { kind: "success", json: mergePlanningChunks(chunks) };
}
