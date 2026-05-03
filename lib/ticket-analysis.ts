import OpenAI from "openai";
import sharp from "sharp";

export const ANALYSIS_VERSION = "2";

/** Version du cache JSON pour l’analyse BL (même pipeline que le relevé de caisse). */
export const BL_ANALYSIS_VERSION = "2";

export type TicketItem = { name: string; qty: number };

/** Ligne extraite d’un bon de livraison (même schéma de base que TicketItem + champs optionnels). */
export type BlDeliveryItem = {
  name: string;
  qty: number;
  unit: string | null;
  unit_price_ht: number | null;
  line_total_ht: number | null;
  /** Fragment conditionnement visible sur la ligne (ex. sac 20 kg), pour conversion stock. */
  packaging_hint: string | null;
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 1800;
const JPEG_QUALITY = 80;

export function extractJson(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function normalizeQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.round(value));
  }

  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.round(parsed));
    }
  }

  return 1;
}

function normalizeItems(input: unknown): TicketItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const item = x as { name?: unknown; qty?: unknown };

      const name =
        typeof item.name === "string"
          ? item.name.trim()
          : "";

      const qty = normalizeQty(item.qty);

      return { name, qty };
    })
    .filter((x) => x.name.length > 0);
}

/** Redimensionne et compresse l'image en JPEG pour réduire coût et tokens. */
export async function preprocessImage(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const processed = await sharp(buffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

const STRICT_PROMPT = `
Return only valid JSON, with no other text, in this exact format:

{"items":[{"name":"string","qty":number}]}

You are analyzing a restaurant receipt.

Goal:
Extract ALL sold item lines visible on the receipt.

Important rules:

- include every visible sold item line
- do not limit extraction to pizzas only
- include drinks, desserts, coffees, supplements, and abbreviated item names if they appear as sold items
- preserve the item label exactly as written on the receipt
- if quantity is not explicitly shown, use qty = 1
- if a line is partially unclear but appears to be a sold item, include it anyway
- it is better to include a doubtful item than to omit one

Ignore only:
- totals
- subtotals
- VAT / tax
- payment lines
- change
- date / time
- ticket number
- cashier / terminal info
`;

/** Même structure de prompt que STRICT_PROMPT (relevé), adaptée au bon de livraison. */
const BL_STRICT_PROMPT = `
Return only valid JSON, with no other text, in this exact format:

{"items":[{"name":"string","qty":number,"unit":null,"unit_price_ht":null,"line_total_ht":null,"packaging_hint":null}]}

You are analyzing a French supplier delivery note (bon de livraison).

Goal:
Extract ALL product line rows visible in the article / designation table.

Important rules:

- include every visible product row
- preserve the product label exactly as written on the document (designation / libellé column)
- qty may be a decimal when shown (e.g. 2.5 for kilograms)
- if quantity is not explicitly shown, use qty = 1
- if a line is partially unclear but appears to be a product row, include it anyway
- it is better to include a doubtful line than to omit one

Optional fields on each item (use null when absent or unreadable):
- unit: unit of measure as printed (kg, L, PI, etc.)
- unit_price_ht: unit price excluding VAT
- line_total_ht: line amount HT
- packaging_hint: literal packaging text from the line when useful for conversion (e.g. "sac 20 kg", "carton 6x1L"); null if not visible or not applicable

Ignore only:
- totals, subtotals, VAT summary lines
- payment lines
- date / time / document metadata lines that are not product rows
- header/footer boilerplate
`;

function parseNumericFieldBl(v: unknown): number | null {
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

function normalizeBlQty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return 1;
}

function normalizeBlItems(input: unknown): BlDeliveryItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const item = x as {
        name?: unknown;
        qty?: unknown;
        unit?: unknown;
        unit_price_ht?: unknown;
        line_total_ht?: unknown;
        packaging_hint?: unknown;
      };

      const name =
        typeof item.name === "string"
          ? item.name.trim()
          : "";

      const qty = normalizeBlQty(item.qty);
      const unitRaw = typeof item.unit === "string" ? item.unit.trim() : "";
      const unit = unitRaw.length > 0 ? unitRaw : null;
      const unit_price_ht = parseNumericFieldBl(item.unit_price_ht);
      const line_total_ht = parseNumericFieldBl(item.line_total_ht);
      const phRaw =
        typeof item.packaging_hint === "string" ? item.packaging_hint.trim() : "";
      const packaging_hint = phRaw.length > 0 ? phRaw : null;

      return {
        name,
        qty,
        unit,
        unit_price_ht: unit_price_ht != null && unit_price_ht > 0 ? unit_price_ht : null,
        line_total_ht: line_total_ht != null && line_total_ht > 0 ? line_total_ht : null,
        packaging_hint,
      };
    })
    .filter((x) => x.name.length > 0);
}

export type AnalyzeOptions = {
  cachedResultJson?: string | null;
  cachedVersion?: string | null;
};

export async function analyzeTicketImage(
  imageUrl: string,
  options?: AnalyzeOptions
): Promise<{ items: TicketItem[]; error?: string }> {
  if (!process.env.OPENAI_API_KEY) {
    const msg = "OPENAI_API_KEY missing";
    console.warn("[ticket-analysis]", msg);
    return { items: [], error: msg };
  }

  if (
    options?.cachedResultJson != null &&
    options?.cachedResultJson !== "" &&
    options?.cachedVersion === ANALYSIS_VERSION
  ) {
    try {
      const parsed = JSON.parse(options.cachedResultJson) as { items?: unknown };
      const items = normalizeItems(parsed?.items);
      return { items };
    } catch {
      /* fallback to API call */
    }
  }

  try {
    const imageBase64 = await preprocessImage(imageUrl);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: STRICT_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageBase64, detail: "high" as const },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      const msg = "empty OpenAI response";
      console.warn("[ticket-analysis]", msg);
      return { items: [], error: msg };
    }

    const jsonStr = extractJson(raw) ?? raw;
    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      const msg = `parse failed: ${(e as Error).message}`;
      console.warn("[ticket-analysis]", msg);
      return { items: [], error: msg };
    }

    const items = normalizeItems(parsed.items);

    console.log("[ticket-analysis] raw model output:", raw);
    console.log("[ticket-analysis] parsed items:", parsed.items);
    console.log("[ticket-analysis] normalized items:", items);

    return { items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "analysis failed";
    console.error("[ticket-analysis] error", e);
    return { items: [], error: msg };
  }
}

/**
 * Analyse d’image de bon de livraison : même pipeline que `analyzeTicketImage`
 * (prétraitement Sharp, gpt-4o, json_object, contenu utilisateur = image seule).
 */
export async function analyzeBlImage(
  imageUrl: string,
  options?: AnalyzeOptions
): Promise<{ items: BlDeliveryItem[]; error?: string }> {
  if (!process.env.OPENAI_API_KEY) {
    const msg = "OPENAI_API_KEY missing";
    console.warn("[bl-analysis]", msg);
    return { items: [], error: msg };
  }

  if (
    options?.cachedResultJson != null &&
    options?.cachedResultJson !== "" &&
    options?.cachedVersion === BL_ANALYSIS_VERSION
  ) {
    try {
      const parsed = JSON.parse(options.cachedResultJson) as { items?: unknown };
      const items = normalizeBlItems(parsed?.items);
      return { items };
    } catch {
      /* fallback to API call */
    }
  }

  try {
    const imageBase64 = await preprocessImage(imageUrl);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BL_STRICT_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageBase64, detail: "high" as const },
            },
          ],
        },
      ],
    });

    const finish = response.choices[0]?.finish_reason;
    if (finish === "length") {
      console.warn("[bl-analysis] response truncated (length)");
      return {
        items: [],
        error:
          "Réponse incomplète du modèle (trop de lignes). Réessayez avec une photo plus recadrée sur le tableau.",
      };
    }

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      const msg = "empty OpenAI response";
      console.warn("[bl-analysis]", msg);
      return { items: [], error: msg };
    }

    const jsonStr = extractJson(raw) ?? raw;
    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      const msg = `parse failed: ${(e as Error).message}`;
      console.warn("[bl-analysis]", msg);
      return { items: [], error: msg };
    }

    const items = normalizeBlItems(parsed.items);

    console.log("[bl-analysis] raw model output (truncated):", raw.slice(0, 2000));
    console.log("[bl-analysis] normalized items:", items);

    return { items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "analysis failed";
    console.error("[bl-analysis] error", e);
    return { items: [], error: msg };
  }
}
