import { analyzeBlImage } from "@/lib/ticket-analysis";

/**
 * Wrapper BL : mêmes entrées/sorties qu’avant, mais l’analyse est faite par
 * `analyzeBlImage` dans `ticket-analysis.ts` (identique au relevé de caisse).
 */

export type BlOpenAiJson = Record<string, unknown>;

export type AnalyzeBlOutcome =
  | { kind: "success"; json: BlOpenAiJson }
  | { kind: "error"; message: string }
  | { kind: "skipped_pdf"; message: string }
  | { kind: "skipped_no_key"; message: string };

function isPdfFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isLikelyImageFileName(name: string): boolean {
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/i.test(name);
}

export async function analyzeBlDocument(publicUrl: string, fileName: string): Promise<AnalyzeBlOutcome> {
  if (!process.env.OPENAI_API_KEY) {
    return { kind: "skipped_no_key", message: "OPENAI_API_KEY manquante." };
  }
  if (isPdfFileName(fileName)) {
    return {
      kind: "skipped_pdf",
      message: "Les PDF ne sont pas pris en charge. Utilisez une photo (JPG, PNG).",
    };
  }
  if (!isLikelyImageFileName(fileName)) {
    return { kind: "error", message: "Format d’image non reconnu (JPG, PNG, WEBP, HEIC…)." };
  }

  const { items, error } = await analyzeBlImage(publicUrl);
  if (error && items.length === 0) {
    return { kind: "error", message: error };
  }

  const json: BlOpenAiJson = {
    items: items.map((i) => ({
      name: i.name,
      qty: i.qty,
      unit: i.unit,
      unit_price_ht: i.unit_price_ht,
      line_total_ht: i.line_total_ht,
      packaging_hint: i.packaging_hint,
    })),
  };

  return { kind: "success", json };
}
