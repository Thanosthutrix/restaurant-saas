import OpenAI from "openai";
import sharp from "sharp";
import {
  HYGIENE_ELEMENT_CATEGORIES,
  type HygieneElementCategory,
} from "@/lib/hygiene/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 1800;
const JPEG_QUALITY = 80;

export type EquipmentAreaKind = "kitchen" | "dining" | "bar" | "storage" | "sanitary" | "other";

export type EquipmentInventorySuggestion = {
  name: string;
  area_kind: EquipmentAreaKind;
  area_label: string;
  hygiene_category: HygieneElementCategory | null;
  quantity: number;
  create_hygiene_element: boolean;
  create_dining_table: boolean;
  notes?: string | null;
  confidence?: "high" | "low" | "unreadable";
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

function normalizeAreaKind(raw: unknown): EquipmentAreaKind {
  if (raw === "kitchen" || raw === "dining" || raw === "bar" || raw === "storage" || raw === "sanitary") {
    return raw;
  }
  const s = typeof raw === "string" ? raw.toLocaleLowerCase("fr") : "";
  if (s.includes("cuisine")) return "kitchen";
  if (s.includes("salle") || s.includes("table")) return "dining";
  if (s.includes("bar")) return "bar";
  if (s.includes("réserve") || s.includes("reserve") || s.includes("stock")) return "storage";
  if (s.includes("toilet") || s.includes("sanitaire")) return "sanitary";
  return "other";
}

function normalizeHygieneCategory(raw: unknown): HygieneElementCategory | null {
  if (typeof raw === "string" && (HYGIENE_ELEMENT_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as HygieneElementCategory;
  }
  const s = typeof raw === "string" ? raw.toLocaleLowerCase("fr") : "";
  if (s.includes("frigo") || s.includes("réfrig")) return "frigo";
  if (s.includes("congel")) return "congelateur";
  if (s.includes("chambre froide")) return "chambre_froide";
  if (s.includes("four")) return "four";
  if (s.includes("hotte")) return "hotte";
  if (s.includes("plaque") || s.includes("piano")) return "piano_plaque";
  if (s.includes("trancheuse")) return "trancheuse";
  if (s.includes("plonge") || s.includes("évier")) return "plonge";
  if (s.includes("plan")) return "plan_travail";
  if (s.includes("sol")) return "sol";
  if (s.includes("étag") || s.includes("etag")) return "etagere";
  if (s.includes("poubelle")) return "poubelle";
  if (s.includes("sanitaire") || s.includes("toilet")) return "sanitaire";
  if (s.includes("machine")) return "machine";
  return null;
}

function defaultHygieneCategoryForName(name: string): HygieneElementCategory | null {
  return normalizeHygieneCategory(name);
}

function normalizeSuggestions(json: unknown): EquipmentInventorySuggestion[] {
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  const rawRows = Array.isArray(obj.items) ? obj.items : Array.isArray(obj.equipment) ? obj.equipment : [];
  const out: EquipmentInventorySuggestion[] = [];
  for (const row of rawRows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().replace(/\s+/g, " ") : "";
    if (!name) continue;
    const areaKind = normalizeAreaKind(r.area_kind ?? r.area ?? r.zone);
    const hygieneCategory = normalizeHygieneCategory(r.hygiene_category) ?? defaultHygieneCategoryForName(name);
    const quantityRaw = Number(r.quantity ?? r.qty ?? 1);
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.min(99, Math.round(quantityRaw)) : 1;
    const tableLike = areaKind === "dining" && /^(table|t\d+|\d+)/i.test(name);
    out.push({
      name,
      area_kind: areaKind,
      area_label: typeof r.area_label === "string" && r.area_label.trim() ? r.area_label.trim() : areaKind === "dining" ? "Salle" : areaKind === "kitchen" ? "Cuisine" : "",
      hygiene_category: hygieneCategory,
      quantity,
      create_hygiene_element: Boolean(hygieneCategory) && areaKind !== "dining",
      create_dining_table: tableLike,
      notes: typeof r.notes === "string" ? r.notes.trim() : null,
      confidence: r.confidence === "high" || r.confidence === "low" || r.confidence === "unreadable" ? r.confidence : "low",
    });
  }
  return out;
}

async function bufferToJpegDataUrl(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

export async function analyzeEquipmentInventoryImageFromBuffer(
  buffer: Buffer
): Promise<{ suggestions: EquipmentInventorySuggestion[]; error?: string }> {
  if (!process.env.OPENAI_API_KEY) return { suggestions: [], error: "OPENAI_API_KEY missing" };
  try {
    const imageUrl = await bufferToJpegDataUrl(buffer);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Réponds uniquement en JSON valide. Extrait le matériel visible pour préparer hygiène et salle. Format: {\"items\":[{\"name\":string,\"area_kind\":\"kitchen\"|\"dining\"|\"bar\"|\"storage\"|\"sanitary\"|\"other\",\"area_label\":string,\"hygiene_category\":string|null,\"quantity\":number,\"notes\":string|null,\"confidence\":\"high\"|\"low\"|\"unreadable\"}]}. Pour hygiene_category utilise si possible: plan_travail, sol, mur, chambre_froide, frigo, congelateur, etagere, hotte, four, piano_plaque, trancheuse, machine, ustensile, bac_gastronorme, plonge, sanitaire, poubelle, poignee_contact, zone_dechets, reserve, vehicule, autre.",
        },
        {
          role: "user",
          content:
            "Analyse cette photo de cuisine, réserve, bar ou salle. Liste uniquement le matériel réellement visible ou très probablement identifiable. Pour les tables de salle, crée une ligne par table ou groupe logique avec un libellé court.",
        },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: imageUrl, detail: "high" as const } }],
        },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return { suggestions: [], error: "Réponse vide du modèle." };
    return { suggestions: normalizeSuggestions(JSON.parse(stripMarkdownCodeBlock(raw))) };
  } catch (e) {
    return { suggestions: [], error: e instanceof Error ? e.message : "Analyse matériel impossible." };
  }
}
