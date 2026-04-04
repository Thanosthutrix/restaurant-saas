import OpenAI from "openai";
import sharp from "sharp";

export const ANALYSIS_VERSION = "2";

export type TicketItem = { name: string; qty: number };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 1800;
const JPEG_QUALITY = 80;

function extractJson(text: string): string | null {
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
async function preprocessImage(imageUrl: string): Promise<string> {
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
