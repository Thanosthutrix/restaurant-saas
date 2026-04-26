"use server";

import { revalidatePath } from "next/cache";
import { createSupplier, updateSupplier, createDeliveryNote, populateDeliveryNoteLinesFromPurchaseOrder, getDeliveryNoteByPurchaseOrderId, createSupplierInvoice } from "@/lib/db";
import type { PreferredOrderMethod } from "@/lib/db";
import { runSupplierInvoiceAnalysis } from "@/lib/run-supplier-invoice-analysis";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createSupplierAction(formData: FormData): Promise<ActionResult> {
  const restaurantId = formData.get("restaurantId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!restaurantId || !name) return { ok: false, error: "Nom requis." };

  const orderDaysRaw = formData.get("orderDays") as string | null;
  const orderDays = orderDaysRaw ? orderDaysRaw.split(",").map((d) => d.trim()).filter(Boolean) : [];

  const { error } = await createSupplier({
    restaurant_id: restaurantId,
    name,
    email: (formData.get("email") as string)?.trim() || null,
    phone: (formData.get("phone") as string)?.trim() || null,
    whatsapp_phone: (formData.get("whatsapp_phone") as string)?.trim() || null,
    address: (formData.get("address") as string)?.trim() || null,
    notes: (formData.get("notes") as string)?.trim() || null,
    preferred_order_method: (formData.get("preferred_order_method") as PreferredOrderMethod) || "EMAIL",
    order_days: orderDays,
    cut_off_time: (formData.get("cut_off_time") as string) || null,
    lead_time_days: formData.get("lead_time_days") ? Number(formData.get("lead_time_days")) : null,
    is_active: formData.get("is_active") !== "false",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  revalidatePath("/suppliers/[id]", "page");
  revalidatePath("/inventory");
  revalidatePath("/orders/suggestions");
  return { ok: true };
}

export async function updateSupplierAction(supplierId: string, formData: FormData): Promise<ActionResult> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { ok: false, error: "Nom requis." };

  const orderDaysRaw = formData.get("orderDays") as string | null;
  const orderDays = orderDaysRaw ? orderDaysRaw.split(",").map((d) => d.trim()).filter(Boolean) : [];

  const { error } = await updateSupplier(supplierId, {
    name,
    email: (formData.get("email") as string)?.trim() || null,
    phone: (formData.get("phone") as string)?.trim() || null,
    whatsapp_phone: (formData.get("whatsapp_phone") as string)?.trim() || null,
    address: (formData.get("address") as string)?.trim() || null,
    notes: (formData.get("notes") as string)?.trim() || null,
    preferred_order_method: (formData.get("preferred_order_method") as PreferredOrderMethod) || "EMAIL",
    order_days: orderDays,
    cut_off_time: (formData.get("cut_off_time") as string) || null,
    lead_time_days: formData.get("lead_time_days") ? Number(formData.get("lead_time_days")) : null,
    is_active: formData.get("is_active") !== "false",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/orders/suggestions");
  return { ok: true };
}

export type CreateDeliveryNoteResult =
  | { ok: true; deliveryNoteId: string }
  | { ok: false; error: string };

export async function createDeliveryNoteAction(params: {
  restaurantId: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  filePath: string;
  fileName: string;
}): Promise<CreateDeliveryNoteResult> {
  if (params.purchaseOrderId) {
    const existing = await getDeliveryNoteByPurchaseOrderId(params.purchaseOrderId);
    if (existing) {
      return { ok: false, error: "Une réception existe déjà pour cette commande fournisseur." };
    }
  }

  const { data, error } = await createDeliveryNote({
    restaurantId: params.restaurantId,
    supplierId: params.supplierId,
    purchaseOrderId: params.purchaseOrderId ?? null,
    filePath: params.filePath,
    fileName: params.fileName,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Erreur à la création du BL." };

  if (params.purchaseOrderId) {
    const { error: linesErr } = await populateDeliveryNoteLinesFromPurchaseOrder(data.id, params.purchaseOrderId);
    if (linesErr) return { ok: false, error: linesErr.message };
  }

  revalidatePath(`/suppliers/${params.supplierId}`);
  revalidatePath("/suppliers/[id]", "page");
  revalidatePath("/orders");
  revalidatePath("/orders/[id]", "page");
  return { ok: true, deliveryNoteId: data.id };
}

export type CreateSupplierInvoiceResult =
  | { ok: true; invoiceId: string }
  | { ok: false; error: string };

export async function createSupplierInvoiceAction(params: {
  restaurantId: string;
  supplierId: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  filePath: string;
  fileName: string;
}): Promise<CreateSupplierInvoiceResult> {
  const { data, error } = await createSupplierInvoice({
    restaurantId: params.restaurantId,
    supplierId: params.supplierId,
    invoiceNumber: params.invoiceNumber ?? null,
    invoiceDate: params.invoiceDate ?? null,
    filePath: params.filePath,
    fileName: params.fileName,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Erreur à la création de la facture." };

  try {
    const analysis = await runSupplierInvoiceAnalysis(data.id, params.restaurantId);
    if (!analysis.ok) {
      console.warn("[createSupplierInvoiceAction] analyse facture:", analysis.error);
    }
  } catch (e) {
    console.error("[createSupplierInvoiceAction] analyse facture exception:", e);
  }

  revalidatePath(`/suppliers/${params.supplierId}`);
  revalidatePath("/suppliers/[id]", "page");
  revalidatePath("/supplier-invoices");
  revalidatePath("/supplier-invoices/[id]", "page");
  return { ok: true, invoiceId: data.id };
}
