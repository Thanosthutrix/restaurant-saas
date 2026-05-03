import { supabaseServer } from "@/lib/supabaseServer";
import { replaceSupplierInvoiceExtractedLines } from "@/lib/db";
import {
  buildMetadataPatchFromAnalysis,
  parseSupplierInvoiceAnalysis,
} from "@/lib/supplier-invoice-analysis";
import { applyVendorHintsFromInvoiceAnalysis } from "@/lib/supplier-vendor-from-invoice";
import {
  analyzeSupplierInvoiceDocument,
  SUPPLIER_INVOICE_ANALYSIS_VERSION,
} from "@/lib/supplier-invoice-openai";
import { SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";

const INVOICE_ANALYSIS_SELECT =
  "id, restaurant_id, supplier_id, invoice_number, invoice_date, file_path, file_name, file_url, amount_ht, amount_ttc, analysis_result_json, analysis_status, analysis_error, analysis_version";

function filePublicUrl(filePath: string | null, fileUrl: string | null): string | null {
  if (fileUrl) return fileUrl;
  if (!filePath) return null;
  const { data } = supabaseServer.storage.from(SUPPLIER_INVOICES_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/** Persiste un JSON d’analyse déjà obtenu (évite un second appel IA). */
export async function applySupplierInvoiceAnalysisResult(
  invoiceId: string,
  restaurantId: string,
  analysisJson: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: inv, error: fetchErr } = await supabaseServer
    .from("supplier_invoices")
    .select(INVOICE_ANALYSIS_SELECT)
    .eq("id", invoiceId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (fetchErr || !inv) {
    return { ok: false, error: "Facture introuvable." };
  }

  const row = inv as {
    file_path: string | null;
    file_url: string | null;
    file_name?: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    amount_ht: number | null;
    amount_ttc: number | null;
  };

  const now = new Date().toISOString();

  await supabaseServer
    .from("supplier_invoices")
    .update({
      analysis_result_json: analysisJson,
      analysis_status: "done",
      analysis_error: null,
      analysis_version: SUPPLIER_INVOICE_ANALYSIS_VERSION,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("restaurant_id", restaurantId);

  const view = parseSupplierInvoiceAnalysis(analysisJson);
  const patch =
    view &&
    buildMetadataPatchFromAnalysis(
      {
        invoice_number: row.invoice_number,
        invoice_date: row.invoice_date,
        amount_ht: row.amount_ht,
        amount_ttc: row.amount_ttc,
      },
      view
    );

  if (patch && Object.keys(patch).length > 0) {
    await supabaseServer
      .from("supplier_invoices")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("restaurant_id", restaurantId);
  }

  const viewForLines = parseSupplierInvoiceAnalysis(analysisJson);
  const { error: linesErr } = await replaceSupplierInvoiceExtractedLines(
    invoiceId,
    viewForLines?.lines ?? []
  );
  if (linesErr) {
    console.error("[applySupplierInvoiceAnalysisResult] lignes extraites:", linesErr.message);
  }

  const supplierRow = inv as { supplier_id?: string };
  if (supplierRow.supplier_id && viewForLines?.vendor) {
    await applyVendorHintsFromInvoiceAnalysis(supplierRow.supplier_id, restaurantId, viewForLines.vendor);
  }

  return { ok: true };
}

/**
 * Lance l’analyse IA sur le fichier facture, enregistre analysis_* et applique le préremplissage métadonnées (champs encore vides).
 */
export async function runSupplierInvoiceAnalysis(
  invoiceId: string,
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: inv, error: fetchErr } = await supabaseServer
    .from("supplier_invoices")
    .select(INVOICE_ANALYSIS_SELECT)
    .eq("id", invoiceId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (fetchErr || !inv) {
    return { ok: false, error: "Facture introuvable." };
  }

  const row = inv as {
    file_path: string | null;
    file_url: string | null;
    file_name?: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    amount_ht: number | null;
    amount_ttc: number | null;
  };

  const publicUrl = filePublicUrl(row.file_path, row.file_url);
  if (!publicUrl) {
    return { ok: false, error: "Aucun fichier associé à cette facture." };
  }

  const fileName = (inv as { file_name?: string | null }).file_name ?? "invoice.jpg";
  const outcome = await analyzeSupplierInvoiceDocument(publicUrl, fileName);
  const now = new Date().toISOString();

  if (outcome.kind === "skipped_no_key") {
    await supabaseServer
      .from("supplier_invoices")
      .update({
        analysis_status: "skipped",
        analysis_error: outcome.message,
        analysis_version: SUPPLIER_INVOICE_ANALYSIS_VERSION,
        updated_at: now,
      })
      .eq("id", invoiceId)
      .eq("restaurant_id", restaurantId);
    return { ok: true };
  }

  if (outcome.kind === "error") {
    await supabaseServer
      .from("supplier_invoices")
      .update({
        analysis_status: "error",
        analysis_error: outcome.message,
        analysis_version: SUPPLIER_INVOICE_ANALYSIS_VERSION,
        updated_at: now,
      })
      .eq("id", invoiceId)
      .eq("restaurant_id", restaurantId);
    return { ok: false, error: outcome.message };
  }

  const analysisJson = outcome.result.json;
  return applySupplierInvoiceAnalysisResult(invoiceId, restaurantId, analysisJson);
}
