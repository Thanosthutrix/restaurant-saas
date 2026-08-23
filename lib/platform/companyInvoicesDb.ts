import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import type { PlatformExpenseCategory } from "@/lib/platform/platformExpenseCategories";

export type PlatformInvoiceStatus = "draft" | "reviewed";

export type PlatformInvoice = {
  id: string;
  company_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount_ht: number | null;
  amount_ttc: number | null;
  expense_category: PlatformExpenseCategory | null;
  file_path: string | null;
  file_name: string | null;
  status: PlatformInvoiceStatus;
  notes: string | null;
  source?: string;
  analysis_status: string | null;
  created_at: string;
  updated_at: string;
};

const INVOICE_SELECT =
  "id, company_id, supplier_id, supplier_name, invoice_number, invoice_date, amount_ht, amount_ttc, expense_category, file_path, file_name, status, notes, source, analysis_status, created_at, updated_at";

export async function listPlatformInvoices(companyId: string): Promise<PlatformInvoice[]> {
  const { data, error } = await supabaseServer
    .from("platform_invoices")
    .select(INVOICE_SELECT)
    .eq("company_id", companyId)
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PlatformInvoice[];
}

export async function getPlatformInvoice(
  companyId: string,
  invoiceId: string
): Promise<PlatformInvoice | null> {
  const { data, error } = await supabaseServer
    .from("platform_invoices")
    .select(INVOICE_SELECT)
    .eq("company_id", companyId)
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw error;
  return (data as PlatformInvoice | null) ?? null;
}

export async function createPlatformInvoice(params: {
  companyId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  expenseCategory?: PlatformExpenseCategory | null;
  amountHt?: number | null;
  amountTtc?: number | null;
}): Promise<PlatformInvoice> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("platform_invoices")
    .insert({
      company_id: params.companyId,
      supplier_id: params.supplierId ?? null,
      supplier_name: params.supplierName?.trim() || null,
      invoice_number: params.invoiceNumber?.trim() || null,
      invoice_date: params.invoiceDate?.trim() || null,
      file_path: params.filePath ?? null,
      file_name: params.fileName ?? null,
      expense_category: params.expenseCategory ?? null,
      amount_ht: params.amountHt ?? null,
      amount_ttc: params.amountTtc ?? null,
      status: "draft",
      updated_at: now,
    })
    .select(INVOICE_SELECT)
    .single();

  if (error || !data) throw error ?? new Error("Création facture impossible.");
  return data as PlatformInvoice;
}

export async function updatePlatformInvoice(
  companyId: string,
  invoiceId: string,
  patch: {
    supplierId?: string | null;
    supplierName?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    amountHt?: number | null;
    amountTtc?: number | null;
    expenseCategory?: PlatformExpenseCategory | null;
    notes?: string | null;
    status?: PlatformInvoiceStatus;
  }
): Promise<PlatformInvoice> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };

  if (patch.supplierId !== undefined) update.supplier_id = patch.supplierId;
  if (patch.supplierName !== undefined) update.supplier_name = patch.supplierName?.trim() || null;
  if (patch.invoiceNumber !== undefined) update.invoice_number = patch.invoiceNumber?.trim() || null;
  if (patch.invoiceDate !== undefined) update.invoice_date = patch.invoiceDate?.trim() || null;
  if (patch.amountHt !== undefined) update.amount_ht = patch.amountHt;
  if (patch.amountTtc !== undefined) update.amount_ttc = patch.amountTtc;
  if (patch.expenseCategory !== undefined) update.expense_category = patch.expenseCategory;
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
  if (patch.status !== undefined) update.status = patch.status;

  const { data, error } = await supabaseServer
    .from("platform_invoices")
    .update(update)
    .eq("company_id", companyId)
    .eq("id", invoiceId)
    .select(INVOICE_SELECT)
    .single();

  if (error || !data) throw error ?? new Error("Mise à jour facture impossible.");
  return data as PlatformInvoice;
}

export function platformInvoicePublicUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  const { data } = supabaseServer.storage.from("supplier-invoices").getPublicUrl(filePath);
  return data.publicUrl;
}
