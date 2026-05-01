import OpenAI from "openai";
import sharp from "sharp";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";
import { supabaseServer } from "@/lib/supabaseServer";
import type { MenuSuggestionItem, MenuSuggestionMode } from "@/lib/menuSuggestionTypes";

export type { MenuSuggestionItem, MenuSuggestionMode } from "@/lib/menuSuggestionTypes";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 1800;
const JPEG_QUALITY = 80;

const LOG_PREFIX = "[menu-analysis]";

/** Enlève un éventuel bloc markdown ```json ... ``` ou ``` ... ```. Ne touche pas au contenu interne. */
function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim();
  const open = trimmed.indexOf("```");
  if (open === -1) return trimmed;
  const afterOpen = trimmed.slice(open + 3).replace(/^json\s*/i, "").trim();
  const close = afterOpen.indexOf("```");
  if (close === -1) return trimmed; // pas de fermeture, garder l'original
  return afterOpen.slice(0, close).trim();
}

/** Extrait un tableau JSON [...] du texte. */
function extractArrayJson(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

/** Extrait un objet JSON {...} du texte (premier { jusqu'au dernier }). */
function extractObjectJson(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function tryParseJson<T>(str: string): { ok: true; data: T } | { ok: false; error: string } {
  try {
    const data = JSON.parse(str) as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "parse error" };
  }
}

/** Accepte PREPARED/RESELL/IGNORE (prompt) ou prepared/resale/ignore, retourne toujours lowercase. */
function normalizeMode(value: unknown): MenuSuggestionMode {
  if (value === "prepared" || value === "resale" || value === "ignore") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    if (v === "prepared" || v === "resale" || v === "ignore") return v;
    if (v === "resell") return "resale";
  }
  return "ignore";
}

function normalizeIngredient(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeSuggestedIngredients(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => normalizeIngredient(x))
    .filter((s) => s.length > 0);
}

function normalizeSuggestedCategory(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/\s+/g, " ");
  return s.length > 0 ? s.slice(0, 80) : null;
}

function normalizeSellingPriceEuro(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/\s/g, "").replace(/€/g, "").replace(",", ".");
    const m = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100;
    }
  }
  return null;
}

function normalizeVatRateFromAi(raw: unknown, mode: MenuSuggestionMode): number {
  if (raw != null) {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  }
  return mode === "resale" ? 20 : 10;
}

/** Récupère le libellé plat depuis plusieurs clés possibles renvoyées par le modèle. */
function getRawLabel(item: Record<string, unknown>): string {
  const keys = ["dish_name", "raw_label", "name", "label", "title"];
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

/** suggested_ingredients ou ingredients. */
function getSuggestedIngredients(item: Record<string, unknown>): unknown {
  return item.suggested_ingredients ?? item.ingredients;
}

/** suggested_mode ou mode. */
function getSuggestedMode(item: Record<string, unknown>): unknown {
  return item.suggested_mode ?? item.mode;
}

/** Prix carte TTC (clés historiques / modèle). */
function getSellingPriceTtc(item: Record<string, unknown>): unknown {
  return (
    item.selling_price_ttc ??
    item.selling_price_ht ??
    item.price_ttc ??
    item.price_ht ??
    item.price ??
    item.menu_price_ht
  );
}

function normalizeSuggestions(input: unknown): MenuSuggestionItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const item = x as Record<string, unknown>;
      const raw = getRawLabel(item);
      const suggested_mode = normalizeMode(getSuggestedMode(item));
      let confidence: number | undefined;
      if (typeof item.confidence === "number" && Number.isFinite(item.confidence)) {
        confidence = Math.max(0, Math.min(1, item.confidence));
      }
      const normalized_label = raw ? normalizeDishLabel(raw) : "";
      const suggested_ingredients = normalizeSuggestedIngredients(getSuggestedIngredients(item));
      const suggested_category = normalizeSuggestedCategory(item.suggested_category ?? item.category ?? item.section);
      const selling_price_ttc = normalizeSellingPriceEuro(getSellingPriceTtc(item));
      const selling_vat_rate_pct = normalizeVatRateFromAi(item.selling_vat_rate_pct, suggested_mode);
      return {
        raw_label: raw,
        normalized_label,
        suggested_mode,
        confidence,
        selling_price_ttc: selling_price_ttc ?? undefined,
        selling_vat_rate_pct,
        suggested_ingredients,
        suggested_category,
      };
    })
    .filter((x) => x.raw_label.length > 0);
}

async function sharpBufferToJpegDataUrl(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

const MENU_PROMPT = `Analyze this restaurant menu photo. Extract only concrete products (dishes, drinks, desserts) that a customer can order.

OUTPUT FORMAT - You MUST respond with ONLY valid JSON, nothing else. No introduction, no markdown, no \`\`\`json, no text after the JSON.
Escape any double quotes inside strings with backslash (e.g. "Pizza \"reine\"").
If no reliable item is found, return exactly: {"items":[]}

Required structure (use these exact keys):
{
  "items": [
    {
      "dish_name": "Exact name as on menu",
      "suggested_category": "Menu section or category, e.g. Pizzas, Pâtes, Desserts",
      "suggested_mode": "PREPARED",
      "selling_price_ttc": 15.95,
      "selling_vat_rate_pct": 10,
      "suggested_ingredients": []
    }
  ]
}

selling_price_ttc: number or null. Unit selling price INCLUDING tax (TTC) in euros, as printed on the menu to the customer (French restaurant menus show TTC). If multiple prices, pick the main one. If unreadable or absent, use null. Do not invent prices.

suggested_category: short customer-facing menu section. Use the printed section title if visible (Pizzas, Pâtes, Desserts, Boissons, Vins, Entrées, Plats, etc.). If no section is visible, infer a simple category from the product family. Do not use ingredients as categories.

selling_vat_rate_pct: optional number, one of 5.5, 10, or 20 when you can infer from category: prepared food / on-premise meal typically 10; alcoholic beverages and many bottled retail items 20; some reduced-rate foods 5.5. If unsure, omit (the app will default: 10 for PREPARED, 20 for RESELL).

suggested_mode: only one of PREPARED, RESELL, IGNORE (uppercase).
- PREPARED: dishes made in-house (main courses, desserts).
- RESELL: items sold as-is (bottled drinks, wines, sodas).
- IGNORE: section titles, marketing, addresses, phone, opening hours, generic formulas like "Menu enfant".

suggested_ingredients: always return [] for this menu analysis. Recipes and ingredients are handled by the dedicated recipe-photo analysis step, not by the menu/card analysis.

Do not include rows that are only a price without a product name. Return ONLY the JSON object.`;

async function runOpenAiMenuAnalysis(
  imageJpegDataUrl: string
): Promise<{ suggestions: MenuSuggestionItem[]; error?: string }> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Respond with ONLY valid JSON. No markdown, no backticks, no text before or after. Use keys: items (array), each item: dish_name (string), suggested_category (string or null), suggested_mode (PREPARED or RESELL or IGNORE), selling_price_ttc (number or null, euros TTC on menu), selling_vat_rate_pct (optional 5.5, 10 or 20), suggested_ingredients (always []). Escape double quotes inside strings with backslash. If no items: {\"items\":[]}",
        },
      { role: "user", content: MENU_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageJpegDataUrl, detail: "high" as const },
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    console.warn(LOG_PREFIX, "empty OpenAI response");
    return { suggestions: [], error: "Réponse vide du modèle." };
  }

  const rawLen = raw.length;
  const rawSample = raw.slice(0, 150).replace(/\n/g, " ");
  console.log(LOG_PREFIX, "response size:", rawLen, "sample:", rawSample + (rawLen > 150 ? "..." : ""));

  let cleaned = raw.trim();
  if (cleaned.includes("```")) {
    cleaned = stripMarkdownCodeBlock(raw);
    console.log(LOG_PREFIX, "stripped markdown block, cleaned length:", cleaned.length);
  }

  let items: unknown[] = [];
  let parseStrategy: "direct" | "object_extract" | "array_extract" | null = null;

  if (cleaned.startsWith("{")) {
    const result = tryParseJson<{ items?: unknown }>(cleaned);
    if (result.ok) {
      parseStrategy = "direct";
      if (Array.isArray(result.data.items)) items = result.data.items;
    }
  } else if (cleaned.startsWith("[")) {
    const result = tryParseJson<unknown[]>(cleaned);
    if (result.ok) {
      parseStrategy = "direct";
      items = Array.isArray(result.data) ? result.data : [];
    }
  }

  if (items.length === 0) {
    const objectStr = extractObjectJson(cleaned);
    if (objectStr) {
      const result = tryParseJson<{ items?: unknown }>(objectStr);
      if (result.ok && Array.isArray(result.data?.items)) {
        items = result.data.items;
        parseStrategy = "object_extract";
      }
    }
  }
  if (items.length === 0) {
    const arrayStr = extractArrayJson(cleaned);
    if (arrayStr) {
      const result = tryParseJson<unknown[]>(arrayStr);
      if (result.ok && Array.isArray(result.data)) {
        items = result.data;
        parseStrategy = "array_extract";
      }
    }
  }

  if (parseStrategy != null) {
    console.log(LOG_PREFIX, "parse success, strategy:", parseStrategy, "items extracted:", items.length);
  } else {
    const parseAttempt = tryParseJson(cleaned);
    const errMsg = parseAttempt.ok ? "unknown" : parseAttempt.error;
    console.warn(LOG_PREFIX, "parse failed:", errMsg, "raw sample:", raw.slice(0, 300));
    return {
      suggestions: [],
      error: `Réponse du modèle invalide (JSON non parsable). Réessayez ou utilisez une autre photo.`,
    };
  }

  const suggestions = normalizeSuggestions(items);
  console.log(LOG_PREFIX, "after normalization, suggestions:", suggestions.length);

  if (suggestions.length === 0 && items.length > 0) {
    const first = items[0] as Record<string, unknown> | null;
    console.warn(LOG_PREFIX, "items parsed but none normalized; first item keys:", first ? Object.keys(first) : "n/a");
  }

  return { suggestions };
}

export async function analyzeMenuImage(
  imageUrl: string
): Promise<{ suggestions: MenuSuggestionItem[]; error?: string }> {
  if (!process.env.OPENAI_API_KEY) {
    const msg = "OPENAI_API_KEY missing";
    console.warn(LOG_PREFIX, msg);
    return { suggestions: [], error: msg };
  }

  try {
    console.log(LOG_PREFIX, "start analysis from url");
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`fetch image: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return analyzeMenuImageFromBuffer(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "analysis failed";
    console.error(LOG_PREFIX, "error", msg, e);
    return { suggestions: [], error: msg };
  }
}

/** Analyse depuis les octets bruts (server action, FormData, etc.). */
export async function analyzeMenuImageFromBuffer(
  buffer: Buffer
): Promise<{ suggestions: MenuSuggestionItem[]; error?: string }> {
  if (!process.env.OPENAI_API_KEY) {
    const msg = "OPENAI_API_KEY missing";
    console.warn(LOG_PREFIX, msg);
    return { suggestions: [], error: msg };
  }

  try {
    const jpegDataUrl = await sharpBufferToJpegDataUrl(buffer);
    return runOpenAiMenuAnalysis(jpegDataUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "analysis failed";
    console.error(LOG_PREFIX, "buffer analysis error", msg, e);
    return { suggestions: [], error: msg };
  }
}

/**
 * Télécharge l’objet Storage avec la service role (bucket privé OK), puis analyse.
 * `path` doit être du type `{restaurant_id}/fichier.jpg`.
 */
export async function analyzeMenuImageFromStoragePath(
  bucket: string,
  path: string
): Promise<{ suggestions: MenuSuggestionItem[]; error?: string }> {
  try {
    console.log(LOG_PREFIX, "start analysis from storage", bucket, path);
    const { data, error: dlErr } = await supabaseServer.storage.from(bucket).download(path);
    if (dlErr) throw new Error(dlErr.message);
    if (!data) throw new Error("Image introuvable dans le stockage.");
    const buffer = Buffer.from(await data.arrayBuffer());
    return analyzeMenuImageFromBuffer(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "analysis failed";
    console.error(LOG_PREFIX, "storage analysis error", msg, e);
    return { suggestions: [], error: msg };
  }
}
