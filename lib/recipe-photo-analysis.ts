import OpenAI from "openai";
import sharp from "sharp";
import { parseAllowedStockUnit, type AllowedUnit } from "@/lib/constants";
import { isPdfBuffer } from "@/lib/isPdfBuffer";
import { normalizeDishLabel } from "@/lib/normalizeDishLabel";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 1800;
const JPEG_QUALITY = 80;
const LOG_PREFIX = "[recipe-photo-analysis]";

export type RecipePhotoIngredient = {
  name: string;
  qty: number | null;
  unit: AllowedUnit | null;
  /** Rubrique composants stock (IA / utilisateur), ex. Légumes, Crèmerie. */
  suggested_stock_category?: string | null;
};

export type RecipePhotoSuggestion = {
  dish_name: string;
  normalized_label: string;
  portions: number | null;
  confidence?: number;
  ingredients: RecipePhotoIngredient[];
  method_notes?: string | null;
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

function extractObjectJson(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function normalizeUnit(raw: unknown): AllowedUnit | null {
  if (typeof raw !== "string") return null;
  const parsed = parseAllowedStockUnit(raw);
  if (parsed) return parsed;
  const s = raw.trim().toLowerCase();
  if (["gramme", "grammes"].includes(s)) return "g";
  if (["kilo", "kilos"].includes(s)) return "kg";
  if (["millilitre", "millilitres"].includes(s)) return "ml";
  if (["unité", "unite", "piece", "pièce", "pcs", "pc"].includes(s)) return "unit";
  return null;
}

function normalizeQty(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

function normalizeSuggestion(input: unknown): RecipePhotoSuggestion[] {
  const root = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rows = Array.isArray(root.recipes) ? root.recipes : [];
  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const r = row as Record<string, unknown>;
      const dish = typeof r.dish_name === "string" ? r.dish_name.trim() : "";
      const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
      const portions = normalizeQty(r.portions);
      const confidence = normalizeQty(r.confidence);
      return {
        dish_name: dish,
        normalized_label: normalizeDishLabel(dish),
        portions,
        confidence: confidence != null ? Math.max(0, Math.min(1, confidence)) : undefined,
        method_notes: typeof r.method_notes === "string" ? r.method_notes.trim() || null : null,
        ingredients: ingredients
          .filter((ing) => ing && typeof ing === "object")
          .map((ing) => {
            const obj = ing as Record<string, unknown>;
            const name = typeof obj.name === "string" ? obj.name.trim() : "";
            const catRaw = obj.stock_category ?? obj.suggested_stock_category ?? obj.ingredient_category;
            const suggested_stock_category =
              typeof catRaw === "string" && catRaw.trim()
                ? catRaw.trim().replace(/\s+/g, " ")
                : null;
            return {
              name,
              qty: normalizeQty(obj.qty_per_portion ?? obj.qty),
              unit: normalizeUnit(obj.unit),
              suggested_stock_category,
            };
          })
          .filter((ing) => ing.name.length > 0),
      };
    })
    .filter((row) => row.dish_name.length > 0 && row.ingredients.length > 0);
}

async function sharpBufferToJpegDataUrl(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

const RECIPE_PROMPT = `Analyze this restaurant recipe document (photo scan or PDF). It can be a printed recipe sheet, handwritten recipe, kitchen notebook, or prep sheet.

Return ONLY valid JSON, no markdown.

Output shape:
{
  "recipes": [
    {
      "dish_name": "Dish name matching the restaurant menu when possible",
      "portions": 4,
      "ingredients": [
        { "name": "Ingredient name", "qty_per_portion": 0.12, "unit": "kg", "stock_category": "Crèmerie" }
      ],
      "method_notes": "short preparation notes if visible",
      "confidence": 0.85
    }
  ]
}

Rules:
- stock_category: optional string, short French warehouse section for this ingredient (e.g. Légumes frais, Viandes, Poissonnerie, Crèmerie, Épicerie sèche, Surgelés, Boissons, Herbes & épices). Omit if unclear.
- If the document contains several recipes, return several recipes.
- Use French ingredient names when visible.
- Quantities must be per served portion when possible. If the sheet gives total quantity for N portions, divide by portions.
- Unit must be one of these exact values only: g, kg, ml, l, unit, sceau.
- If a quantity is unreadable, set qty_per_portion to null and keep the ingredient.
- Do not invent ingredients or quantities. If no reliable recipe is found, return {"recipes":[]}.`;

const RECIPE_SYSTEM_PROMPT =
  "You extract restaurant recipes from images or PDFs. Respond only with valid JSON using key recipes.";

function parseRecipeModelOutput(raw: string | null | undefined): { suggestions: RecipePhotoSuggestion[]; error?: string } {
  if (!raw) return { suggestions: [], error: "Réponse vide du modèle." };
  try {
    const cleaned = raw.includes("```") ? stripMarkdownCodeBlock(raw) : raw.trim();
    const json = cleaned.startsWith("{") ? cleaned : (extractObjectJson(cleaned) ?? cleaned);
    const parsed = JSON.parse(json) as unknown;
    return { suggestions: normalizeSuggestion(parsed) };
  } catch (e) {
    return { suggestions: [], error: e instanceof Error ? e.message : "Réponse JSON invalide." };
  }
}

async function analyzeRecipePdfFromBuffer(buffer: Buffer): Promise<{ suggestions: RecipePhotoSuggestion[]; error?: string }> {
  const fileData = `data:application/pdf;base64,${buffer.toString("base64")}`;
  const combinedText = `${RECIPE_SYSTEM_PROMPT}\n\n${RECIPE_PROMPT}`;
  const response = await openai.responses.create({
    model: "gpt-4o",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: combinedText },
          { type: "input_file", filename: "recettes.pdf", file_data: fileData },
        ],
      },
    ],
  });
  return parseRecipeModelOutput(response.output_text);
}

export async function analyzeRecipeImageFromBuffer(
  buffer: Buffer
): Promise<{ suggestions: RecipePhotoSuggestion[]; error?: string }> {
  try {
    if (isPdfBuffer(buffer)) {
      return await analyzeRecipePdfFromBuffer(buffer);
    }
    const imageJpegDataUrl = await sharpBufferToJpegDataUrl(buffer);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: RECIPE_SYSTEM_PROMPT,
        },
        { role: "user", content: RECIPE_PROMPT },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: imageJpegDataUrl, detail: "high" as const } }],
        },
      ],
    });
    return parseRecipeModelOutput(response.choices[0]?.message?.content);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analyse recette impossible.";
    console.warn(LOG_PREFIX, message);
    return { suggestions: [], error: message };
  }
}
