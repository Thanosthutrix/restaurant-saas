"use server";

import { revalidatePath } from "next/cache";
import { linkDeliveryNotesToSupplierInvoice, updateSupplierInvoice } from "@/lib/db";
import { runSupplierInvoiceAnalysis } from "@/lib/run-supplier-invoice-analysis";

export async function linkReceptionsToInvoiceAction(
  invoiceId: string,
  deliveryNoteIds: string[],
  restaurantId: string
): Promise<{ error: string | null }> {
  const { error } = await linkDeliveryNotesToSupplierInvoice(invoiceId, deliveryNoteIds, restaurantId);
  if (error) return { error: error.message };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath(`/suppliers/[id]`, "page");
  return { error: null };
}

export type UpdateInvoiceMetadataResult = { success: true } | { success: false; error: string };

export async function updateSupplierInvoiceMetadataAction(
  invoiceId: string,
  restaurantId: string,
  formData: FormData
): Promise<UpdateInvoiceMetadataResult> {
  const invoiceNumber = formData.get("invoice_number");
  const invoiceDate = formData.get("invoice_date");
  const amountHt = formData.get("amount_ht");
  const amountTtc = formData.get("amount_ttc");

  const invoice_number =
    typeof invoiceNumber === "string" ? (invoiceNumber.trim() || null) : null;
  const invoice_date =
    typeof invoiceDate === "string" && invoiceDate.trim()
      ? invoiceDate.trim()
      : null;
  let amount_ht: number | null = null;
  let amount_ttc: number | null = null;
  if (typeof amountHt === "string" && amountHt.trim()) {
    const n = parseFloat(amountHt.replace(",", "."));
    if (!Number.isNaN(n)) amount_ht = n;
  }
  if (typeof amountTtc === "string" && amountTtc.trim()) {
    const n = parseFloat(amountTtc.replace(",", "."));
    if (!Number.isNaN(n)) amount_ttc = n;
  }

  const { data, error } = await updateSupplierInvoice(invoiceId, restaurantId, {
    invoice_number,
    invoice_date,
    amount_ht,
    amount_ttc,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath(`/suppliers/${data?.supplier_id ?? ""}`, "page");
  return { success: true };
}

export type RerunInvoiceAnalysisResult =
  | { success: true; message?: string }
  | { success: false; error: string };

/** Relance l’analyse sur le fichier (image). Ne modifie pas le stock. */
export async function rerunInvoiceAnalysisAction(
  invoiceId: string,
  restaurantId: string
): Promise<RerunInvoiceAnalysisResult> {
  const result = await runSupplierInvoiceAnalysis(invoiceId, restaurantId);
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath("/suppliers/[id]", "page");
  return { success: true };
}
