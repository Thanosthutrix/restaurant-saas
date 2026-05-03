"use server";

import { revalidatePath } from "next/cache";
import { getRestaurantForPage } from "@/lib/auth";
import {
  linkDeliveryNotesToSupplierInvoice,
  replaceSupplierInvoiceExtractedLines,
  updateSupplierInvoice,
  updateSupplierInvoiceStatus,
  getSupplier,
  getSupplierInvoiceFileUrl,
  SUPPLIER_INVOICES_BUCKET,
} from "@/lib/db";
import { sendSupplierInvoiceClaimEmail } from "@/lib/messaging/supplierInvoiceClaimEmails";
import { runSupplierInvoiceAnalysis } from "@/lib/run-supplier-invoice-analysis";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveReceptionLineUnitCosts } from "@/lib/stock/receptionUnitCost";
import type { SupplierInvoiceAnalysisLine } from "@/lib/supplier-invoice-analysis";
import {
  defaultDropboxUploadRoot,
  extensionFromFileName,
  isDropboxExportConfigured,
  sanitizeDropboxPathSegment,
  uploadBytesToDropbox,
} from "@/lib/dropboxClient";

export async function linkReceptionsToInvoiceAction(
  invoiceId: string,
  deliveryNoteIds: string[],
  restaurantId: string
): Promise<{ error: string | null }> {
  const { error } = await linkDeliveryNotesToSupplierInvoice(invoiceId, deliveryNoteIds, restaurantId);
  if (error) return { error: error.message };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath("/supplier-invoices");
  revalidatePath(`/suppliers/[id]`, "page");
  return { error: null };
}

export async function unlinkReceptionFromInvoiceAction(
  invoiceId: string,
  deliveryNoteId: string,
  restaurantId: string
): Promise<{ error: string | null }> {
  const { data: invoice, error: invErr } = await supabaseServer
    .from("supplier_invoices")
    .select("id, restaurant_id")
    .eq("id", invoiceId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (invErr) return { error: invErr.message };
  if (!invoice) return { error: "Facture introuvable." };

  const { data: note, error: noteErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id")
    .eq("id", deliveryNoteId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (noteErr) return { error: noteErr.message };
  if (!note) return { error: "Réception introuvable." };

  const { error: delErr } = await supabaseServer
    .from("supplier_invoice_delivery_notes")
    .delete()
    .eq("supplier_invoice_id", invoiceId)
    .eq("delivery_note_id", deliveryNoteId);
  if (delErr) return { error: delErr.message };

  const { error: clearLinesErr } = await supabaseServer
    .from("delivery_note_lines")
    .update({ supplier_invoice_extracted_line_id: null })
    .eq("delivery_note_id", deliveryNoteId);
  if (clearLinesErr) return { error: clearLinesErr.message };

  const { error: clearMovErr } = await supabaseServer
    .from("stock_movements")
    .update({ supplier_invoice_id: null })
    .eq("restaurant_id", restaurantId)
    .eq("delivery_note_id", deliveryNoteId)
    .eq("supplier_invoice_id", invoiceId);
  if (clearMovErr) return { error: clearMovErr.message };

  const { data: remaining } = await supabaseServer
    .from("supplier_invoice_delivery_notes")
    .select("id")
    .eq("supplier_invoice_id", invoiceId)
    .limit(1);
  const nextStatus = remaining && remaining.length > 0 ? "linked" : "draft";
  const { error: statusErr } = await updateSupplierInvoiceStatus(invoiceId, restaurantId, nextStatus);
  if (statusErr) return { error: statusErr.message };

  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath(`/receiving/${deliveryNoteId}`);
  revalidatePath("/supplier-invoices");
  return { error: null };
}

export type SendSupplierInvoiceClaimEmailResult =
  | { ok: true; data: { alreadySent: boolean } }
  | { ok: false; error: string };

/** Envoi de la réclamation par e-mail au fournisseur (Resend), comme pour les commandes fournisseur. */
export async function sendSupplierInvoiceClaimEmailAction(params: {
  invoiceId: string;
  restaurantId: string;
}): Promise<SendSupplierInvoiceClaimEmailResult> {
  const result = await sendSupplierInvoiceClaimEmail(params);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/supplier-invoices/${params.invoiceId}`);
  revalidatePath("/supplier-invoices");
  return { ok: true, data: { alreadySent: result.alreadySent } };
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
  revalidatePath("/supplier-invoices");
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
  revalidatePath("/supplier-invoices");
  revalidatePath("/suppliers/[id]", "page");
  return { success: true };
}

export async function updateSupplierInvoiceExtractedLinesAction(
  invoiceId: string,
  restaurantId: string,
  lines: SupplierInvoiceAnalysisLine[]
): Promise<{ success: true } | { success: false; error: string }> {
  const { data: invoice, error: invErr } = await supabaseServer
    .from("supplier_invoices")
    .select("id, restaurant_id, analysis_result_json")
    .eq("id", invoiceId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (invErr) return { success: false, error: invErr.message };
  if (!invoice) return { success: false, error: "Facture introuvable." };

  const cleaned = lines
    .map((line) => ({
      label: String(line.label ?? "").trim(),
      quantity: line.quantity == null || !Number.isFinite(Number(line.quantity)) ? null : Number(line.quantity),
      unit: line.unit == null || String(line.unit).trim() === "" ? null : String(line.unit).trim(),
      unit_price:
        line.unit_price == null || !Number.isFinite(Number(line.unit_price)) ? null : Number(line.unit_price),
      line_total:
        line.line_total == null || !Number.isFinite(Number(line.line_total)) ? null : Number(line.line_total),
    }))
    .filter((line) => line.label.length > 0);

  const replace = await replaceSupplierInvoiceExtractedLines(invoiceId, cleaned);
  if (replace.error) return { success: false, error: replace.error.message };

  const rawJson = (invoice as { analysis_result_json?: unknown | null }).analysis_result_json;
  const currentJson =
    rawJson && typeof rawJson === "object" && !Array.isArray(rawJson)
      ? (rawJson as Record<string, unknown>)
      : {};
  const { error: updateErr } = await supabaseServer
    .from("supplier_invoices")
    .update({
      analysis_result_json: { ...currentJson, lines: cleaned },
      analysis_status: "done",
      analysis_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("restaurant_id", restaurantId);
  if (updateErr) return { success: false, error: updateErr.message };

  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath("/supplier-invoices");
  return { success: true };
}

async function applyInvoiceCostsToValidatedReceptions(invoiceId: string, restaurantId: string): Promise<void> {
  const { data: pivots, error: pivotErr } = await supabaseServer
    .from("supplier_invoice_delivery_notes")
    .select("delivery_note_id")
    .eq("supplier_invoice_id", invoiceId);
  if (pivotErr) throw new Error(pivotErr.message);

  const deliveryNoteIds = (pivots ?? []).map((p: { delivery_note_id: string }) => p.delivery_note_id);
  if (deliveryNoteIds.length === 0) return;

  const { data: notes, error: notesErr } = await supabaseServer
    .from("delivery_notes")
    .select("id, restaurant_id, status")
    .in("id", deliveryNoteIds)
    .eq("restaurant_id", restaurantId);
  if (notesErr) throw new Error(notesErr.message);
  const validatedNoteIds = new Set(
    (notes ?? [])
      .filter((n: { status: string }) => n.status === "validated" || n.status === "received")
      .map((n: { id: string }) => n.id)
  );
  if (validatedNoteIds.size === 0) return;

  const { data: rawLines, error: linesErr } = await supabaseServer
    .from("delivery_note_lines")
    .select(
      "id, delivery_note_id, inventory_item_id, qty_received, label, purchase_order_line_id, bl_line_total_ht, bl_unit_price_stock_ht, manual_unit_price_stock_ht, supplier_invoice_extracted_line_id"
    )
    .in("delivery_note_id", [...validatedNoteIds]);
  if (linesErr) throw new Error(linesErr.message);

  const lines = (rawLines ?? []).filter((l: { inventory_item_id: string | null }) => l.inventory_item_id);
  if (lines.length === 0) return;

  const unitCostByLineId = await resolveReceptionLineUnitCosts({
    restaurantId,
    supplierInvoiceId: invoiceId,
    lines: lines.map((l) => {
      const row = l as {
        id: string;
        label?: string | null;
        inventory_item_id: string;
        qty_received: unknown;
        purchase_order_line_id?: string | null;
        bl_line_total_ht?: unknown;
        bl_unit_price_stock_ht?: unknown;
        manual_unit_price_stock_ht?: unknown;
        supplier_invoice_extracted_line_id?: string | null;
      };
      return {
        id: row.id,
        label: row.label ?? null,
        inventory_item_id: row.inventory_item_id,
        qty_received: Number(row.qty_received) || 0,
        purchase_order_line_id: row.purchase_order_line_id ?? null,
        bl_line_total_ht: row.bl_line_total_ht != null ? Number(row.bl_line_total_ht) : null,
        bl_unit_price_stock_ht: row.bl_unit_price_stock_ht != null ? Number(row.bl_unit_price_stock_ht) : null,
        manual_unit_price_stock_ht:
          row.manual_unit_price_stock_ht != null ? Number(row.manual_unit_price_stock_ht) : null,
        supplier_invoice_extracted_line_id: row.supplier_invoice_extracted_line_id ?? null,
      };
    }),
  });

  for (const line of lines as { id: string }[]) {
    const unitCost = unitCostByLineId[line.id];
    if (unitCost == null || !Number.isFinite(unitCost) || unitCost <= 0) continue;

    const { data: movements, error: movErr } = await supabaseServer
      .from("stock_movements")
      .update({ unit_cost: unitCost, supplier_invoice_id: invoiceId })
      .eq("restaurant_id", restaurantId)
      .eq("delivery_note_line_id", line.id)
      .select("id");
    if (movErr) throw new Error(movErr.message);

    const movementIds = (movements ?? []).map((m: { id: string }) => m.id);
    if (movementIds.length > 0) {
      const { error: lotsErr } = await supabaseServer
        .from("inventory_stock_lots")
        .update({ unit_cost: unitCost })
        .in("source_stock_movement_id", movementIds);
      if (lotsErr) throw new Error(lotsErr.message);
    }
  }
}

export async function markSupplierInvoiceReviewedAction(
  invoiceId: string,
  restaurantId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await applyInvoiceCostsToValidatedReceptions(invoiceId, restaurantId);
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Impossible d’appliquer les coûts facture." };
  }
  const { error } = await updateSupplierInvoiceStatus(invoiceId, restaurantId, "reviewed");
  if (error) return { success: false, error: error.message };
  revalidatePath(`/supplier-invoices/${invoiceId}`);
  revalidatePath("/supplier-invoices");
  revalidatePath("/suppliers/[id]", "page");
  return { success: true };
}

export async function exportSupplierInvoiceToDropboxAction(
  invoiceId: string,
  restaurantId: string
): Promise<{ ok: true; pathDisplay: string } | { ok: false; error: string }> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant || restaurant.id !== restaurantId) {
    return { ok: false, error: "Non autorisé." };
  }
  if (!isDropboxExportConfigured()) {
    return { ok: false, error: "Export Dropbox non configuré sur le serveur." };
  }

  const { data: inv, error: invErr } = await supabaseServer
    .from("supplier_invoices")
    .select("id, restaurant_id, supplier_id, invoice_number, file_path, file_name, file_url, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr) return { ok: false, error: invErr.message };
  if (!inv) return { ok: false, error: "Facture introuvable." };
  if ((inv as { restaurant_id: string }).restaurant_id !== restaurantId) {
    return { ok: false, error: "Facture introuvable." };
  }
  if ((inv as { status: string }).status !== "reviewed") {
    return { ok: false, error: "Marquez d’abord la facture comme prête comptable." };
  }

  const row = inv as {
    supplier_id: string;
    invoice_number: string | null;
    file_path: string | null;
    file_name: string | null;
    file_url: string | null;
  };

  let bytes: Uint8Array;
  if (row.file_path) {
    const { data: blob, error: dlErr } = await supabaseServer.storage
      .from(SUPPLIER_INVOICES_BUCKET)
      .download(row.file_path);
    if (dlErr || !blob) {
      return { ok: false, error: dlErr?.message ?? "Impossible de lire le fichier sur le stockage." };
    }
    bytes = new Uint8Array(await blob.arrayBuffer());
  } else if (row.file_url) {
    const r = await fetch(row.file_url);
    if (!r.ok) return { ok: false, error: `Impossible de télécharger le fichier facture (${r.status}).` };
    bytes = new Uint8Array(await r.arrayBuffer());
  } else {
    return { ok: false, error: "Aucun fichier n’est associé à cette facture." };
  }

  const { data: supplier } = await getSupplier(row.supplier_id);
  const supplierSeg = sanitizeDropboxPathSegment(supplier?.name ?? "fournisseur");
  const numSeg = sanitizeDropboxPathSegment(row.invoice_number?.trim() || "sans-numero", 48);
  const ext = extensionFromFileName(row.file_name);
  const base = `${supplierSeg}_${numSeg}_${invoiceId.slice(0, 8)}`;
  const root = defaultDropboxUploadRoot();
  const dropboxPath = `${root}/${base}${ext}`;

  try {
    const { path_display } = await uploadBytesToDropbox({ dropboxPath, bytes });
    return { ok: true, pathDisplay: path_display };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Échec de l’envoi vers Dropbox.",
    };
  }
}

/** URL + nom de fichier pour le widget Dropbox Saver (enregistrement côté navigateur). */
export async function prepareSupplierInvoiceDropboxSaverAction(
  invoiceId: string,
  restaurantId: string
): Promise<{ ok: true; url: string; filename: string } | { ok: false; error: string }> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant || restaurant.id !== restaurantId) {
    return { ok: false, error: "Non autorisé." };
  }

  const { data: inv, error: invErr } = await supabaseServer
    .from("supplier_invoices")
    .select("id, restaurant_id, file_path, file_name, file_url, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invErr) return { ok: false, error: invErr.message };
  if (!inv) return { ok: false, error: "Facture introuvable." };
  if ((inv as { restaurant_id: string }).restaurant_id !== restaurantId) {
    return { ok: false, error: "Facture introuvable." };
  }
  if ((inv as { status: string }).status !== "reviewed") {
    return { ok: false, error: "Marquez d’abord la facture comme prête comptable." };
  }

  const row = inv as {
    file_path: string | null;
    file_name: string | null;
    file_url: string | null;
  };

  let url: string | null = null;
  if (row.file_path) {
    const { data: signed, error: signErr } = await supabaseServer.storage
      .from(SUPPLIER_INVOICES_BUCKET)
      .createSignedUrl(row.file_path, 900);
    if (!signErr && signed?.signedUrl) url = signed.signedUrl;
    if (!url) url = getSupplierInvoiceFileUrl(row.file_path);
  }
  if (!url && row.file_url) {
    url = row.file_url;
  }
  if (!url) {
    return { ok: false, error: "Aucun fichier n’est associé à cette facture." };
  }

  const ext = extensionFromFileName(row.file_name);
  let filename: string;
  const rawName = row.file_name?.trim();
  if (rawName) {
    const dot = rawName.lastIndexOf(".");
    const base = dot > 0 ? rawName.slice(0, dot) : rawName;
    const seg = sanitizeDropboxPathSegment(base, 120);
    filename = seg ? `${seg}${ext}` : `facture-${invoiceId.slice(0, 8)}${ext}`;
  } else {
    filename = `facture-${invoiceId.slice(0, 8)}${ext}`;
  }

  return { ok: true, url, filename };
}
