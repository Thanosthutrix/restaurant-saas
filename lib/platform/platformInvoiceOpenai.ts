import OpenAI from "openai";
import sharp from "sharp";
import { PLATFORM_EXPENSE_CATEGORY_VALUES } from "@/lib/platform/platformExpenseCategories";

export const PLATFORM_INVOICE_ANALYSIS_VERSION = "1";

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

const categories = PLATFORM_EXPENSE_CATEGORY_VALUES.map((v) => `"${v}"`).join(" | ");

const PLATFORM_INVOICE_PROMPT = `
Tu es un assistant qui lit une facture reçue par une société éditrice de logiciel SaaS (Ubion).
Retourne UNIQUEMENT un JSON valide, sans texte avant ou après, au format exact :

{
  "invoice_number": string | null,
  "invoice_date": string | null,
  "amount_ht": number | null,
  "amount_ttc": number | null,
  "expense_category": ${categories},
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

expense_category — poste comptable :
- "infra_hebergement" : hébergement, cloud, domaines, serveurs (Vercel, AWS, Supabase…)
- "logiciels_saas" : abonnements logiciels, licences, outils dev
- "marketing" : publicité, communication, agence
- "rh_personnel" : salaires, URSSAF, mutuelle, recrutement
- "prestataires" : comptable, avocat, conseil
- "bureaux" : loyer, déplacements, frais généraux
- "impots_taxes" : impôts, TVA, taxes
- "financier" : banque, intérêts, leasing
- "divers" : si aucune catégorie ne convient

Règles :
- invoice_date au format YYYY-MM-DD si visible, sinon null.
- Montants en nombre décimal (point), sans symbole €.
- vendor = émetteur de la facture (fournisseur), pas Ubion.
`;

export type PlatformInvoiceAnalysisOutcome =
  | { kind: "ok"; json: Record<string, unknown> }
  | { kind: "skipped_no_key"; message: string }
  | { kind: "error"; message: string };

export async function analyzePlatformInvoiceDocument(
  fileUrl: string,
  fileName: string
): Promise<PlatformInvoiceAnalysisOutcome> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return { kind: "skipped_no_key", message: "OPENAI_API_KEY non configurée." };
  }

  try {
    const isPdf = isPdfFileName(fileName);
    const content = isPdf
      ? [
          { type: "text" as const, text: PLATFORM_INVOICE_PROMPT },
          {
            type: "file" as const,
            file: { filename: fileName, file_data: await pdfDataUrlFromUrl(fileUrl) },
          },
        ]
      : [
          { type: "text" as const, text: PLATFORM_INVOICE_PROMPT },
          {
            type: "image_url" as const,
            image_url: { url: await preprocessImageFromUrl(fileUrl), detail: "high" as const },
          },
        ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      max_tokens: 4096,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonStr = extractJson(raw);
    if (!jsonStr) return { kind: "error", message: "Réponse IA illisible." };
    return { kind: "ok", json: JSON.parse(jsonStr) as Record<string, unknown> };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
