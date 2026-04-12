import OpenAI from "openai";
import sharp from "sharp";

export const DELIVERY_NOTE_ANALYSIS_VERSION = "6";

/** Snapshot compatible sorties structurées (schéma JSON strict). */
const DELIVERY_NOTE_MODEL = "gpt-4o-2024-08-06";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Plus grand = meilleure lisibilité des tableaux et des chiffres sur photo. */
const MAX_IMAGE_DIMENSION = 4096;
const JPEG_QUALITY = 92;

/**
 * Schéma JSON strict OpenAI (pas de Zod : évite bundling / paquets incomplets côté npm).
 * @see https://platform.openai.com/docs/guides/structured-outputs
 */
const DELIVERY_NOTE_LINE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: {
      type: "string",
      description:
        "Texte EXACT de la colonne désignation / libellé tel qu’imprimé sur cette ligne (copie caractère par caractère). Interdit : inventer une marque (ex. Danone) ou reformuler.",
    },
    quantity: { anyOf: [{ type: "number" }, { type: "null" }] },
    unit: { anyOf: [{ type: "string" }, { type: "null" }] },
    unit_price_ht: { anyOf: [{ type: "number" }, { type: "null" }] },
    line_total_ht: { anyOf: [{ type: "number" }, { type: "null" }] },
  },
  required: ["label", "quantity", "unit", "unit_price_ht", "line_total_ht"],
} as const;

const DELIVERY_NOTE_ROOT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    /** high = tableau et chiffres lisibles ; low = doute partiel ; unreadable = pas de BL lisible ou pas de tableau fiable */
    extraction_confidence: { type: "string", enum: ["high", "low", "unreadable"] },
    extraction_notes: { anyOf: [{ type: "string" }, { type: "null" }] },
    supplier_name_on_document: { anyOf: [{ type: "string" }, { type: "null" }] },
    bl_number: { anyOf: [{ type: "string" }, { type: "null" }] },
    delivery_date: { anyOf: [{ type: "string" }, { type: "null" }] },
    lines: {
      type: "array",
      items: DELIVERY_NOTE_LINE_JSON_SCHEMA,
    },
    raw_text: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: [
    "extraction_confidence",
    "extraction_notes",
    "supplier_name_on_document",
    "bl_number",
    "delivery_date",
    "lines",
    "raw_text",
  ],
} as const;

function extractJson(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

function isPdfFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isLikelyImageFileName(name: string): boolean {
  const n = name.toLowerCase();
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/.test(n);
}

function looksLikeImageBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return true;
  }
  // GIF / WebP (RIFF…WEBP)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  return false;
}

async function preprocessImageFromUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Téléchargement du fichier : ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!looksLikeImageBuffer(buffer)) {
    throw new Error(
      "Le fichier téléchargé ne ressemble pas à une image (URL expirée, page HTML ou fichier corrompu ?)."
    );
  }
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height || meta.width < 32 || meta.height < 32) {
    throw new Error("Image trop petite ou illisible après décodage.");
  }
  // Pas de normalize() : sur photos déjà nettes ça peut dégrader le contraste ; sharp redimensionne seulement.
  const processed = await sharp(buffer)
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

/**
 * Le schéma impose un JSON, pas une réponse « vide » : on force donc extraction_confidence + lignes vides si échec.
 */
const BL_SYSTEM_PROMPT = `Tu lis une PHOTO de document (souvent un bon de livraison ou bordereau).

LIBELLÉS "label" (règle critique) :
- Chaque "label" doit être la COPIE EXACTE du texte imprimé dans la colonne désignation / article pour CETTE ligne (comme sur le papier).
- Interdit d’utiliser des noms de marques ou produits « connus » tirés de ta mémoire (ex. Danone, Président, etc.) si ces mots n’apparaissent PAS sur cette ligne du document.
- Interdit de fusionner plusieurs lignes du tableau en une seule phrase inventée.
- Si le surlignage (stabilo) recouvre le texte, lis uniquement ce qui est encore visible ; si tu ne peux pas lire mot pour mot, mets extraction_confidence à "low" ou "unreadable" plutôt que d’inventer.
- Un vrai BL a en général des libellés DIFFÉRENTS sur des lignes différentes. Si tu t’apprêtes à mettre le même texte dans "label" pour toutes les lignes, tu te trompes : mets "unreadable", lines [] et explique dans extraction_notes.

Champ extraction_confidence :
- "high" UNIQUEMENT si le tableau est lisible et que chaque ligne a un libellé distinct copié fidèlement depuis l’image.
- "low" : seulement les lignes certaines.
- "unreadable" : doute, texte illisible, ou risque d’invention : lines [].

Autres règles :
- N’invente pas de lignes. Champs numériques null si illisible. Décimales FR → nombre JSON.
- Exclure totaux globaux, TVA récap seule, hors lignes articles.

En-tête : supplier_name_on_document, bl_number, delivery_date (YYYY-MM-DD) si lisibles, sinon null.
raw_text : description factuelle courte. extraction_notes : utile si low/unreadable.`;

export type DeliveryNoteOpenAiResult = {
  json: Record<string, unknown>;
};

export type AnalyzeDeliveryNoteOutcome =
  | { kind: "success"; result: DeliveryNoteOpenAiResult }
  | { kind: "error"; message: string }
  | { kind: "skipped_pdf"; message: string }
  | { kind: "skipped_no_key"; message: string };

function parseDeliveryNoteContent(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  const jsonStr = extractJson(raw) ?? raw;
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.lines)) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Analyse une photo de BL : sortie structurée stricte (JSON Schema + OpenAI) pour limiter les champs manquants / hors schéma.
 */
export async function analyzeDeliveryNoteDocument(
  publicUrl: string,
  fileName: string
): Promise<AnalyzeDeliveryNoteOutcome> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      kind: "skipped_no_key",
      message: "OPENAI_API_KEY manquante : analyse automatique désactivée.",
    };
  }

  if (isPdfFileName(fileName)) {
    return {
      kind: "skipped_pdf",
      message:
        "Les PDF ne sont pas analysés automatiquement en V1. Utilisez une photo (JPG, PNG) ou saisissez les lignes sur l’écran de réception.",
    };
  }

  if (!isLikelyImageFileName(fileName)) {
    return {
      kind: "error",
      message:
        "Format non reconnu pour l’analyse automatique. Formats acceptés : JPG, PNG, WEBP, GIF, HEIC.",
    };
  }

  try {
    const imageBase64 = await preprocessImageFromUrl(publicUrl);

    const response = await openai.chat.completions.create({
      model: DELIVERY_NOTE_MODEL,
      max_tokens: 8192,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "delivery_note",
          strict: true,
          description:
            "Extraction BL. Les labels sont des copies exactes de la colonne désignation. Pas de marques inventées. Si doute, unreadable et lines=[].",
          schema: DELIVERY_NOTE_ROOT_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages: [
        { role: "system", content: BL_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Bon de livraison ou avis de livraison : transcris le tableau article par article. Pour chaque ligne, le champ label = texte imprimé dans la colonne désignation de cette ligne uniquement. Ne réutilise pas le même libellé pour toutes les lignes sauf si le document le montre ainsi (rare).",
            },
            {
              type: "image_url",
              image_url: { url: imageBase64, detail: "high" as const },
            },
          ],
        },
      ],
    });

    const choice = response.choices[0];
    const msg = choice?.message;
    if (msg?.refusal) {
      return { kind: "error", message: msg.refusal };
    }

    if (choice?.finish_reason === "length") {
      return {
        kind: "error",
        message:
          "Réponse tronquée : l’image est peut‑être trop dense. Recadrez ou photographiez le tableau des lignes plus net.",
      };
    }

    const parsed = parseDeliveryNoteContent(msg?.content);
    if (parsed) {
      return { kind: "success", result: { json: parsed } };
    }

    return { kind: "error", message: "Réponse d’analyse sans données exploitables." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec de l’analyse";
    console.error("[delivery-note-openai]", e);
    return { kind: "error", message: msg };
  }
}
