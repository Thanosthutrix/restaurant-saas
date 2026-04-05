import OpenAI from "openai";
import sharp from "sharp";

export const DELIVERY_NOTE_ANALYSIS_VERSION = "1";

function extractJson(text: string): string | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 2000;
const JPEG_QUALITY = 82;

function isPdfFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isLikelyImageFileName(name: string): boolean {
  const n = name.toLowerCase();
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/.test(n);
}

async function preprocessImageFromUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Téléchargement du fichier : ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const processed = await sharp(buffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

const BL_PROMPT = `
Tu es un assistant qui lit un bon de livraison (BL) fournisseur pour la restauration / alimentaire.
Retourne UNIQUEMENT un JSON valide, sans texte avant ou après, au format exact :

{
  "supplier_name_on_document": string | null,
  "bl_number": string | null,
  "delivery_date": string | null,
  "lines": [
    {
      "label": string,
      "quantity": number | null,
      "unit": string | null,
      "unit_price_ht": number | null,
      "line_total_ht": number | null
    }
  ],
  "raw_text": string | null
}

Règles :
- supplier_name_on_document : raison sociale ou en-tête fournisseur visible sur le BL (pas le restaurant livré).
- delivery_date au format YYYY-MM-DD si tu la déduis, sinon null.
- Montants en nombre décimal (point), sans symbole €, en hors taxes si indiqué.
- Extrais toutes les lignes de produits / articles livrés (hors totaux TVA récapitulatifs seuls).
- quantity : quantité livrée pour la ligne ; unit : unité (kg, L, colis, pièce…).
- Si une information est illisible ou absente, mets null.
- raw_text : court résumé utile (optionnel).
`;

export type DeliveryNoteOpenAiResult = {
  json: Record<string, unknown>;
};

export type AnalyzeDeliveryNoteOutcome =
  | { kind: "success"; result: DeliveryNoteOpenAiResult }
  | { kind: "error"; message: string }
  | { kind: "skipped_pdf"; message: string }
  | { kind: "skipped_no_key"; message: string };

/**
 * Analyse une photo de BL (même pipeline que la facture fournisseur : images seules en V1).
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
      model: "gpt-4o",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BL_PROMPT },
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
      return { kind: "error", message: "Réponse vide du modèle d’analyse." };
    }

    const jsonStr = extractJson(raw) ?? raw;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch (e) {
      return { kind: "error", message: `JSON invalide : ${(e as Error).message}` };
    }

    return { kind: "success", result: { json: parsed } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec de l’analyse";
    console.error("[delivery-note-openai]", e);
    return { kind: "error", message: msg };
  }
}
