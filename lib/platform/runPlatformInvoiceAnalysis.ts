import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";
import {
  buildMetadataPatchFromAnalysis,
  parseSupplierInvoiceAnalysis,
  type SupplierInvoiceAnalysisLine,
} from "@/lib/supplier-invoice-analysis";
import {
  guessPlatformExpenseCategory,
  isPlatformExpenseCategory,
} from "@/lib/platform/platformExpenseCategories";
import {
  analyzePlatformInvoiceDocument,
  PLATFORM_INVOICE_ANALYSIS_VERSION,
} from "@/lib/platform/platformInvoiceOpenai";
import { createPlatformSupplier } from "@/lib/platform/companyDb";

const INVOICE_SELECT =
  "id, company_id, supplier_id, supplier_name, invoice_number, invoice_date, amount_ht, amount_ttc, expense_category, file_path, file_name, analysis_result_json, analysis_status, analysis_error";

function filePublicUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  const { data } = supabaseServer.storage.from(SUPPLIER_INVOICES_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function replacePlatformInvoiceExtractedLines(
  invoiceId: string,
  lines: SupplierInvoiceAnalysisLine[]
): Promise<void> {
  await supabaseServer.from("platform_invoice_extracted_lines").delete().eq("platform_invoice_id", invoiceId);
  if (!lines.length) return;
  await supabaseServer.from("platform_invoice_extracted_lines").insert(
    lines.map((l, i) => ({
      platform_invoice_id: invoiceId,
      sort_order: i,
      label: l.label,
      quantity: l.quantity,
      unit: l.unit,
      unit_price: l.unit_price,
      line_total: l.line_total,
    }))
  );
}

export async function runPlatformInvoiceAnalysis(
  invoiceId: string,
  companyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: inv, error: fetchErr } = await supabaseServer
    .from("platform_invoices")
    .select(INVOICE_SELECT)
    .eq("id", invoiceId)
    .eq("company_id", companyId)
    .single();

  if (fetchErr || !inv) return { ok: false, error: "Facture introuvable." };

  const row = inv as {
    file_path: string | null;
    file_name: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    amount_ht: number | null;
    amount_ttc: number | null;
    expense_category: string | null;
    supplier_id: string | null;
    supplier_name: string | null;
  };

  const publicUrl = filePublicUrl(row.file_path);
  if (!publicUrl) return { ok: false, error: "Aucun fichier associé." };

  const fileName = row.file_name ?? "invoice.pdf";
  const outcome = await analyzePlatformInvoiceDocument(publicUrl, fileName);
  const now = new Date().toISOString();

  if (outcome.kind === "skipped_no_key") {
    await supabaseServer
      .from("platform_invoices")
      .update({
        analysis_status: "skipped",
        analysis_error: outcome.message,
        analysis_version: PLATFORM_INVOICE_ANALYSIS_VERSION,
        updated_at: now,
      })
      .eq("id", invoiceId);
    return { ok: true };
  }

  if (outcome.kind === "error") {
    await supabaseServer
      .from("platform_invoices")
      .update({
        analysis_status: "error",
        analysis_error: outcome.message,
        analysis_version: PLATFORM_INVOICE_ANALYSIS_VERSION,
        updated_at: now,
      })
      .eq("id", invoiceId);
    return { ok: false, error: outcome.message };
  }

  const analysisJson = outcome.json;
  const aiCategory = analysisJson.expense_category;
  const vendorName = (analysisJson.vendor as { legal_name?: string } | undefined)?.legal_name ?? row.supplier_name;
  const expenseCategory = isPlatformExpenseCategory(String(aiCategory ?? ""))
    ? aiCategory
    : guessPlatformExpenseCategory(String(vendorName ?? ""));

  await supabaseServer
    .from("platform_invoices")
    .update({
      analysis_result_json: analysisJson,
      analysis_status: "done",
      analysis_error: null,
      analysis_version: PLATFORM_INVOICE_ANALYSIS_VERSION,
      ...(row.expense_category ? {} : { expense_category: expenseCategory }),
      updated_at: now,
    })
    .eq("id", invoiceId);

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
      .from("platform_invoices")
      .update({ ...patch, updated_at: now })
      .eq("id", invoiceId);
  }

  await replacePlatformInvoiceExtractedLines(invoiceId, view?.lines ?? []);

  // Enrichir / créer fournisseur si absent
  if (!row.supplier_id && view?.vendor?.legal_name) {
    const supplier = await createPlatformSupplier({
      companyId,
      name: view.vendor.legal_name,
      email: view.vendor.email,
      siret: view.vendor.siret,
    });
    await supabaseServer
      .from("platform_invoices")
      .update({
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        updated_at: now,
      })
      .eq("id", invoiceId);
  }

  return { ok: true };
}

export async function listPlatformInvoiceExtractedLines(invoiceId: string) {
  const { data } = await supabaseServer
    .from("platform_invoice_extracted_lines")
    .select("sort_order, label, quantity, unit, unit_price, line_total")
    .eq("platform_invoice_id", invoiceId)
    .order("sort_order");
  return data ?? [];
}
