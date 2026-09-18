import OpenAI from "openai";
import sharp from "sharp";

export const SUPPLIER_INVOICE_ANALYSIS_VERSION = "2";

const INVOICE_MODEL = "gpt-4o-2024-08-06";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_IMAGE_DIMENSION = 4096;
const JPEG_QUALITY = 92;

const INVOICE_LINE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: {
      type: "string",
      description:
        "Copie EXACTE du libellé / désignation imprimé sur cette ligne. Interdit d'inventer des marques ou produits absents du document.",
    },
    quantity: { anyOf: [{ type: "number" }, { type: "null" }] },
    unit: { anyOf: [{ type: "string" }, { type: "null" }] },
    unit_price: { anyOf: [{ type: "number" }, { type: "null" }] },
    line_total: { anyOf: [{ type: "number" }, { type: "null" }] },
  },
  required: ["label", "quantity", "unit", "unit_price", "line_total"],
} as const;

const INVOICE_VENDOR_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    legal_name: { anyOf: [{ type: "string" }, { type: "null" }] },
    address: { anyOf: [{ type: "string" }, { type: "null" }] },
    email: { anyOf: [{ type: "string" }, { type: "null" }] },
    phone: { anyOf: [{ type: "string" }, { type: "null" }] },
    vat_number: { anyOf: [{ type: "string" }, { type: "null" }] },
    siret: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["legal_name", "address", "email", "phone", "vat_number", "siret"],
} as const;

const INVOICE_ROOT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    extraction_confidence: { type: "string", enum: ["high", "low", "unreadable"] },
    extraction_notes: { anyOf: [{ type: "string" }, { type: "null" }] },
    invoice_number: { anyOf: [{ type: "string" }, { type: "null" }] },
    invoice_date: { anyOf: [{ type: "string" }, { type: "null" }] },
    amount_ht: { anyOf: [{ type: "number" }, { type: "null" }] },
    amount_ttc: { anyOf: [{ type: "number" }, { type: "null" }] },
    expense_category: {
      type: "string",
      enum: [
        "matieres",
        "rh",
        "locaux",
        "entretien",
        "prestataires",
        "marketing_banque",
        "impots_taxes",
        "financier",
      ],
    },
    vendor: INVOICE_VENDOR_JSON_SCHEMA,
    lines: { type: "array", items: INVOICE_LINE_JSON_SCHEMA },
    raw_text: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: [
    "extraction_confidence",
    "extraction_notes",
    "invoice_number",
    "invoice_date",
    "amount_ht",
    "amount_ttc",
    "expense_category",
    "vendor",
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
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
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
      "Le fichier téléchargé ne ressemble pas à une image (URL expirée ou fichier corrompu ?)."
    );
  }
  // Photos smartphone (cuisine, faible lumière, léger flou) : léger renforcement avant envoi au modèle.
  const processed = await sharp(buffer)
    .rotate()
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .sharpen({ sigma: 0.6, m1: 0.5, m2: 0.5 })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

async function pdfDataUrlFromUrl(fileUrl: string): Promise<string> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Téléchargement du PDF : ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:application/pdf;base64,${buffer.toString("base64")}`;
}

const INVOICE_SYSTEM_PROMPT = `Tu lis une facture reçue par un restaurant (achats alimentaires, énergie, assurance, maintenance, abonnements, taxes…).

LIBELLÉS "label" (règle critique) :
- Chaque "label" = COPIE EXACTE du texte imprimé sur cette ligne (désignation / libellé article).
- Interdit d'utiliser des noms de marques ou produits « connus » si absents du document.
- Interdit de mettre le même libellé sur toutes les lignes sauf si le document le montre ainsi (rare).
- Si le texte est illisible, mets extraction_confidence à "low" ou "unreadable" plutôt que d'inventer.

extraction_confidence :
- "high" : tableau lisible, libellés distincts copiés fidèlement.
- "low" : seulement les lignes certaines.
- "unreadable" : doute ou illisible → lines [].

expense_category — poste comptable (choisis le plus adapté) :
- "matieres" : denrées, boissons, emballages, hygiène HACCP.
- "rh" : mutuelle, prévoyance, formation, intérim.
- "locaux" : loyer, charges, électricité, gaz, eau, assurances.
- "entretien" : hotte, maintenance matériel, vaisselle, blanchisserie.
- "prestataires" : comptable, juridique, logiciels, fournitures bureau.
- "marketing_banque" : commissions livraison, pub, frais CB/TPE, frais bancaires.
- "impots_taxes" : CFE, taxe foncière, SACEM, taxes locales.
- "financier" : intérêts, leasing, crédit-bail.
En cas de doute sur une facture alimentaire, choisis "matieres".

Autres règles :
- invoice_date au format YYYY-MM-DD si lisible, sinon null.
- Montants en nombre décimal (point), sans symbole €.
- amount_ht / amount_ttc : totaux en pied de facture si visibles.
- Privilégie unit_price et line_total en HT ; si seul le TTC par ligne est visible, extrais tel quel.
- Exclure les lignes de total TVA / total TTC récapitulatif (pas des articles).
- vendor = émetteur de la facture (pas le restaurant client).
- raw_text : résumé factuel court. extraction_notes si low/unreadable.`;

function parseInvoiceContent(raw: string | null | undefined): Record<string, unknown> | null {
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

/** Prompt texte pour l'analyse PDF (Responses API). */
const INVOICE_PDF_PROMPT = `${INVOICE_SYSTEM_PROMPT}

Retourne UNIQUEMENT un JSON valide au format :
{
  "extraction_confidence": "high" | "low" | "unreadable",
  "extraction_notes": string | null,
  "invoice_number": string | null,
  "invoice_date": string | null,
  "amount_ht": number | null,
  "amount_ttc": number | null,
  "expense_category": "matieres" | "rh" | "locaux" | "entretien" | "prestataires" | "marketing_banque" | "impots_taxes" | "financier",
  "vendor": { "legal_name", "address", "email", "phone", "vat_number", "siret" },
  "lines": [{ "label", "quantity", "unit", "unit_price", "line_total" }],
  "raw_text": string | null
}`;

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
              { type: "input_text", text: INVOICE_PDF_PROMPT },
              { type: "input_file", filename: fileName || "facture.pdf", file_data: fileData },
            ],
          },
        ],
      });
      const raw = response.output_text;
      if (!raw) return { kind: "error", message: "Réponse vide du modèle d’analyse PDF." };
      const parsed = parseInvoiceContent(raw);
      if (!parsed) {
        return { kind: "error", message: "Réponse d’analyse PDF sans données exploitables." };
      }
      return { kind: "success", result: { json: parsed } };
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
      model: INVOICE_MODEL,
      max_tokens: 8192,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "supplier_invoice",
          strict: true,
          description:
            "Extraction facture. Labels = copies exactes. Pas de marques inventées. Si doute, unreadable et lines=[].",
          schema: INVOICE_ROOT_JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      messages: [
        { role: "system", content: INVOICE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Facture fournisseur : transcris le tableau article par article. Chaque label = texte imprimé sur cette ligne uniquement.",
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
          "Réponse tronquée : recadrez la photo sur le tableau des lignes ou utilisez un PDF si disponible.",
      };
    }

    const parsed = parseInvoiceContent(msg?.content);
    if (!parsed) {
      return { kind: "error", message: "Réponse d’analyse sans données exploitables." };
    }

    return { kind: "success", result: { json: parsed } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Échec de l’analyse";
    console.error("[supplier-invoice-openai]", e);
    return { kind: "error", message: msg };
  }
}
