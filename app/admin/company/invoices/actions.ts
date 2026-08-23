"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin";
import {
  createPlatformInvoice,
  updatePlatformInvoice,
  type PlatformInvoiceStatus,
} from "@/lib/platform/companyInvoicesDb";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import { runPlatformInvoiceAnalysis } from "@/lib/platform/runPlatformInvoiceAnalysis";
import {
  guessPlatformExpenseCategory,
  isPlatformExpenseCategory,
  type PlatformExpenseCategory,
} from "@/lib/platform/platformExpenseCategories";
import { SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  isDropboxExportConfigured,
  sanitizeDropboxPathSegment,
  uploadBytesToDropbox,
  defaultDropboxUploadRoot,
} from "@/lib/dropboxClient";

export type InvoiceActionResult =
  | { ok: true; invoiceId?: string }
  | { ok: false; error: string };

async function gateAdmin(): Promise<InvoiceActionResult | { ok: true }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès refusé." };
  return { ok: true };
}

export async function createPlatformInvoiceAction(params: {
  supplierId?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  amountHt?: number | null;
  amountTtc?: number | null;
  expenseCategory?: string | null;
}): Promise<InvoiceActionResult> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;

  const company = await getPlatformCompany();
  if (!company) {
    return { ok: false, error: "Configurez d'abord le profil de votre société." };
  }

  if (!params.supplierId && !params.supplierName?.trim()) {
    return { ok: false, error: "Indiquez un fournisseur." };
  }

  const category = isPlatformExpenseCategory(params.expenseCategory ?? "")
    ? params.expenseCategory
    : guessPlatformExpenseCategory(params.supplierName ?? "");

  try {
    const invoice = await createPlatformInvoice({
      companyId: company.id,
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      invoiceNumber: params.invoiceNumber,
      invoiceDate: params.invoiceDate,
      filePath: params.filePath,
      fileName: params.fileName,
      amountHt: params.amountHt,
      amountTtc: params.amountTtc,
      expenseCategory: category as PlatformExpenseCategory,
    });
    revalidatePath("/admin/company/invoices");
    revalidatePath(`/admin/company/invoices/${invoice.id}`);

    if (params.filePath) {
      runPlatformInvoiceAnalysis(invoice.id, company.id).catch((e) =>
        console.warn("[createPlatformInvoiceAction] analyse:", e)
      );
    }

    return { ok: true, invoiceId: invoice.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur facture." };
  }
}

export async function updatePlatformInvoiceAction(params: {
  invoiceId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  amountHt?: number | null;
  amountTtc?: number | null;
  expenseCategory?: string | null;
  notes?: string | null;
  status?: PlatformInvoiceStatus;
}): Promise<InvoiceActionResult> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;

  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Société non configurée." };

  const category =
    params.expenseCategory === undefined
      ? undefined
      : isPlatformExpenseCategory(params.expenseCategory)
        ? params.expenseCategory
        : null;

  try {
    await updatePlatformInvoice(company.id, params.invoiceId, {
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      invoiceNumber: params.invoiceNumber,
      invoiceDate: params.invoiceDate,
      amountHt: params.amountHt,
      amountTtc: params.amountTtc,
      expenseCategory: category as PlatformExpenseCategory | null | undefined,
      notes: params.notes,
      status: params.status,
    });
    revalidatePath("/admin/company/invoices");
    revalidatePath(`/admin/company/invoices/${params.invoiceId}`);
    return { ok: true, invoiceId: params.invoiceId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur mise à jour." };
  }
}

export async function markPlatformInvoiceReviewedAction(
  invoiceId: string
): Promise<InvoiceActionResult> {
  return updatePlatformInvoiceAction({ invoiceId, status: "reviewed" });
}

export async function rerunPlatformInvoiceAnalysisAction(
  invoiceId: string
): Promise<InvoiceActionResult> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;
  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Société non configurée." };

  const result = await runPlatformInvoiceAnalysis(invoiceId, company.id);
  if (!result.ok) return result;
  revalidatePath(`/admin/company/invoices/${invoiceId}`);
  return { ok: true, invoiceId };
}

export async function exportPlatformInvoiceToDropboxAction(
  invoiceId: string
): Promise<{ ok: true; pathDisplay: string } | { ok: false; error: string }> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès refusé." };
  if (!isDropboxExportConfigured()) {
    return { ok: false, error: "Export Dropbox non configuré." };
  }

  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Société non configurée." };

  const { data: inv, error: invErr } = await supabaseServer
    .from("platform_invoices")
    .select("id, company_id, supplier_name, invoice_number, file_path, file_name, status")
    .eq("id", invoiceId)
    .eq("company_id", company.id)
    .maybeSingle();

  if (invErr || !inv) return { ok: false, error: "Facture introuvable." };
  const row = inv as {
    supplier_name: string | null;
    invoice_number: string | null;
    file_path: string | null;
    file_name: string | null;
    status: string;
  };
  if (row.status !== "reviewed") {
    return { ok: false, error: "Marquez d'abord la facture comme prête comptable." };
  }
  if (!row.file_path) return { ok: false, error: "Aucun fichier associé." };

  const { data: blob, error: dlErr } = await supabaseServer.storage
    .from(SUPPLIER_INVOICES_BUCKET)
    .download(row.file_path);
  if (dlErr || !blob) return { ok: false, error: dlErr?.message ?? "Lecture fichier impossible." };

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const supplierSeg = sanitizeDropboxPathSegment(row.supplier_name ?? "fournisseur");
  const numSeg = sanitizeDropboxPathSegment(row.invoice_number?.trim() || "sans-numero", 48);
  const ext = row.file_name?.split(".").pop() || "pdf";
  const root = defaultDropboxUploadRoot().replace("fournisseurs", "Ubion");
  const dropboxPath = `${root}/${supplierSeg}_${numSeg}_${invoiceId.slice(0, 8)}.${ext}`;

  try {
    const uploaded = await uploadBytesToDropbox({ dropboxPath, bytes });
    return { ok: true, pathDisplay: uploaded.path_display };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur Dropbox." };
  }
}
