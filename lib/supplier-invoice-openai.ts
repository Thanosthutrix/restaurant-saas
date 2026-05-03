import OpenAI from "openai";
import sharp from "sharp";
export const SUPPLIER_INVOICE_ANALYSIS_VERSION = "1";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_SIZE = 2000;
const JPEG_QUALITY = 82;

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

async function pdfDataUrlFromUrl(fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Téléchargement du PDF : ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:application/pdf;base64,${buffer.toString("base64")}`;
}

const INVOICE_PROMPT = `
Tu es un assistant qui lit une facture fournisseur (restauration / alimentaire).
Retourne UNIQUEMENT un JSON valide, sans texte avant ou après, au format exact :

{
  "invoice_number": string | null,
  "invoice_date": string | null,
  "amount_ht": number | null,
  "amount_ttc": number | null,
  "vendor": {
    "legal_name": string | null,
    "address": string | null,
    "email": string | null,
    "phone": string | null,
    "vat_number": string | null,
    "siret": string | null
  },
  "lines": [
    {
      "label": string,
      "quantity": number | null,
      "unit": string | null,
      "unit_price": number | null,
      "line_total": number | null
    }
  ],
  "raw_text": string | null
}

Règles :
- invoice_date au format YYYY-MM-DD si tu la déduis, sinon null.
- Montants en nombre décimal (point), sans symbole €.
- amount_ht : total hors taxes (HT) indiqué sur la facture, si visible.
- amount_ttc : total toutes taxes comprises en pied de facture, si visible (distinct du HT).
- Pour chaque ligne de produit/prestation : privilégie unit_price et line_total en HORS TAXES (HT) ; si la facture ne montre que du TTC par ligne, extrais tel quel, mais amount_ht doit refléter le total HT global de la facture si présent.
- Extrais toutes les lignes de produits / prestations visibles (hors lignes de simple total TVA ou total TTC récapitulatif si ce ne sont pas des lignes d’article).
- Si une information est illisible ou absente, mets null.
- raw_text : court résumé ou extrait texte utile (optionnel, peut être null).

Bloc vendor (vendeur / émetteur de la facture — pas le restaurant client) :
- legal_name : raison sociale ou dénomination du fournisseur qui émet la facture.
- address : adresse complète du siège ou établissement émetteur si visible.
- email, phone : coordonnées du fournisseur imprimées sur le document.
- vat_number : numéro de TVA intracommunautaire (ex. FR…).
- siret : SIRET ou identifiant d’établissement français si présent.
Ne pas remplir vendor avec les coordonnées du client facturé (votre restaurant).
`;

export type SupplierInvoiceOpenAiResult = {
  /** Objet prêt à stocker dans analysis_result_json */
  json: Record<string, unknown>;
};

export type AnalyzeSupplierInvoiceOutcome =
  | { kind: "success"; result: SupplierInvoiceOpenAiResult }
  | { kind: "error"; message: string }
  | { kind: "skipped_no_key"; message: string };

/**
 * Analyse le document facture (image ou PDF).
 * @param publicUrl URL publique du fichier (Storage)
 * @param fileName nom d’origine (détection PDF / image)
 */
export async function analyzeSupplierInvoiceDocument(
  publicUrl: string,
  fileName: string
): Promise<AnalyzeSupplierInvoiceOutcome> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      kind: "skipped_no_key",
      message: "OPENAI_API_KEY manquante : analyse automatique désactivée.",
    };
  }

  if (isPdfFileName(fileName)) {
    try {
      const fileData = await pdfDataUrlFromUrl(publicUrl);
      const response = await openai.responses.create({
        model: "gpt-4o",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: INVOICE_PROMPT },
              { type: "input_file", filename: fileName || "facture.pdf", file_data: fileData },
            ],
          },
        ],
      });
      const raw = response.output_text;
      if (!raw) return { kind: "error", message: "Réponse vide du modèle d’analyse PDF." };
      const jsonStr = extractJson(raw) ?? raw;
      return { kind: "success", result: { json: JSON.parse(jsonStr) as Record<string, unknown> } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l’analyse PDF";
      console.error("[supplier-invoice-openai:pdf]", e);
      return { kind: "error", message: msg };
    }
  }

  if (!isLikelyImageFileName(fileName)) {
    return {
      kind: "error",
      message:
        "Format de fichier non reconnu pour l’analyse automatique. Formats acceptés : JPG, PNG, WEBP, GIF, HEIC.",
    };
  }

  try {
    const imageBase64 = await preprocessImageFromUrl(publicUrl);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INVOICE_PROMPT },
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
    console.error("[supplier-invoice-openai]", e);
    return { kind: "error", message: msg };
  }
}
