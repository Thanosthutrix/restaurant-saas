"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { DELIVERY_NOTES_BUCKET, SUPPLIER_INVOICES_BUCKET } from "@/lib/constants";
import {
  createDeliveryNoteFromUpload,
  createSupplier,
  createSupplierInvoice,
  getInventoryItems,
  getSupplierInvoiceFileUrl,
  getSuppliers,
} from "@/lib/db";
import { findInventoryMatchCandidates } from "@/lib/matching/findInventoryMatchCandidates";
import type { PendingOnboardingPurchasePriceSuggestion } from "@/lib/onboardingPendingMenuStorage";
import { analyzeEquipmentInventoryImageFromBuffer, type EquipmentInventorySuggestion } from "@/lib/equipment-inventory-analysis";
import { getImageBuffersFromFormData, getMenuImageBuffersFromFormData } from "@/lib/getMenuImageBuffersFromFormData";
import { analyzeMenuImageFromBuffer } from "@/lib/menu-analysis";
import { mergeMenuSuggestionsByNormalizedLabel } from "@/lib/mergeMenuSuggestions";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import { analyzeRecipeImageFromBuffer, type RecipePhotoSuggestion } from "@/lib/recipe-photo-analysis";
import { analyzeRevenueStatementImageFromBuffer, REVENUE_EXTRACTION_VERSION } from "@/lib/revenue-statement-analysis";
import { resolveOrCreateSupplierFromInvoiceVendor } from "@/lib/resolveSupplierFromInvoiceVendor";
import { runDeliveryNoteAnalysis } from "@/lib/run-delivery-note-analysis";
import {
  applySupplierInvoiceAnalysisResult,
  runSupplierInvoiceAnalysis,
} from "@/lib/run-supplier-invoice-analysis";
import { parseSupplierInvoiceAnalysis } from "@/lib/supplier-invoice-analysis";
import {
  analyzeSupplierInvoiceDocument,
  SUPPLIER_INVOICE_ANALYSIS_VERSION,
  type AnalyzeSupplierInvoiceOutcome,
} from "@/lib/supplier-invoice-openai";
import { supabaseServer } from "@/lib/supabaseServer";

export type AnalyzeOnboardingImportsResult = {
  ok: boolean;
  menuSuggestions?: MenuSuggestionItem[];
  recipeSuggestions?: RecipePhotoSuggestion[];
  equipmentSuggestions?: EquipmentInventorySuggestion[];
  errors: string[];
};

export type OnboardingBusinessImportsResult = {
  ok: boolean;
  deliveryNotesCreated: number;
  supplierInvoicesCreated: number;
  revenueMonthsImported: number;
  purchasePriceSuggestions: PendingOnboardingPurchasePriceSuggestion[];
  errors: string[];
};

type FormFile = File;

function isUsableFile(value: FormDataEntryValue): value is FormFile {
  return typeof value !== "string" && value.size > 0;
}

function fileNameOf(file: FormFile, fallback: string): string {
  return file.name.trim() ? file.name.trim() : fallback;
}

function fileExt(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
}

async function uploadFormFile(params: {
  bucket: string;
  restaurantId: string;
  folder: string;
  file: FormFile;
  fallbackName: string;
}): Promise<{ path: string; fileName: string; error?: string }> {
  const fileName = fileNameOf(params.file, params.fallbackName);
  const path = `${params.restaurantId}/${params.folder}/${crypto.randomUUID()}.${fileExt(fileName)}`;
  const { error } = await supabaseServer.storage
    .from(params.bucket)
    .upload(path, Buffer.from(await params.file.arrayBuffer()), {
      contentType: params.file.type || undefined,
      upsert: false,
    });
  if (error) return { path, fileName, error: error.message };
  return { path, fileName };
}

async function resolveSupplier(restaurantId: string, supplierId: string, supplierName: string) {
  const trimmedId = supplierId.trim();
  if (trimmedId) return { id: trimmedId, error: null };

  const trimmedName = supplierName.trim();
  if (!trimmedName) return { id: null, error: "Choisissez ou saisissez un fournisseur." };

  const { data: suppliers, error } = await getSuppliers(restaurantId);
  if (error) return { id: null, error: error.message };
  const existing = (suppliers ?? []).find(
    (s) => s.name.trim().toLocaleLowerCase("fr") === trimmedName.toLocaleLowerCase("fr")
  );
  if (existing) return { id: existing.id, error: null };

  const created = await createSupplier({
    restaurant_id: restaurantId,
    name: trimmedName,
    preferred_order_method: "EMAIL",
    order_days: [],
    is_active: true,
  });
  if (created.error || !created.data) {
    return { id: null, error: created.error?.message ?? "Création du fournisseur impossible." };
  }
  return { id: created.data.id, error: null };
}

async function persistOnboardingInvoiceAnalysis(
  invoiceId: string,
  restaurantId: string,
  outcome: AnalyzeSupplierInvoiceOutcome
): Promise<void> {
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
    return;
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
    return;
  }
  await applySupplierInvoiceAnalysisResult(invoiceId, restaurantId, outcome.result.json);
}

async function collectPurchasePriceSuggestionsForInvoice(params: {
  restaurantId: string;
  invoiceId: string;
  supplierId: string | null;
}): Promise<PendingOnboardingPurchasePriceSuggestion[]> {
  const [{ data: items }, { data: lines }] = await Promise.all([
    getInventoryItems(params.restaurantId),
    supabaseServer
      .from("supplier_invoice_extracted_lines")
      .select("id, label, quantity, unit, unit_price, line_total, sort_order")
      .eq("supplier_invoice_id", params.invoiceId)
      .order("sort_order", { ascending: true }),
  ]);

  const stockItems = (items ?? []).map((item) => ({ id: item.id, name: item.name }));
  const suggestions: PendingOnboardingPurchasePriceSuggestion[] = [];
  for (const raw of lines ?? []) {
    const row = raw as {
      id: string;
      label: string;
      quantity: unknown;
      unit: unknown;
      unit_price: unknown;
      line_total: unknown;
    };
    const unitPrice = row.unit_price == null || row.unit_price === "" ? null : Number(row.unit_price);
    const lineTotal = row.line_total == null || row.line_total === "" ? null : Number(row.line_total);
    const quantity = row.quantity == null || row.quantity === "" ? null : Number(row.quantity);
    const price =
      unitPrice != null && Number.isFinite(unitPrice) && unitPrice > 0
        ? unitPrice
        : lineTotal != null &&
            Number.isFinite(lineTotal) &&
            lineTotal > 0 &&
            quantity != null &&
            Number.isFinite(quantity) &&
            quantity > 0
          ? Math.round((lineTotal / quantity) * 1_000_000) / 1_000_000
          : null;
    if (price == null) continue;

    const match = findInventoryMatchCandidates(row.label, stockItems);
    const matched = match.bestId ? stockItems.find((item) => item.id === match.bestId) : null;
    suggestions.push({
      invoice_id: params.invoiceId,
      extracted_line_id: row.id,
      supplier_id: params.supplierId,
      label: row.label,
      quantity: quantity != null && Number.isFinite(quantity) ? quantity : null,
      unit: row.unit == null ? null : String(row.unit),
      unit_price_ht: unitPrice != null && Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : price,
      line_total_ht: lineTotal != null && Number.isFinite(lineTotal) && lineTotal > 0 ? lineTotal : null,
      suggested_inventory_item_id: matched?.id ?? null,
      suggested_inventory_item_name: matched?.name ?? null,
    });
  }
  return suggestions;
}

async function processRevenueStatementFiles(
  restaurant: { id: string },
  revenueFiles: FormFile[]
): Promise<{ revenueMonthsImported: number; errors: string[] }> {
  let revenueMonthsImported = 0;
  const errors: string[] = [];

  for (const file of revenueFiles) {
    if (file.type && !file.type.startsWith("image/")) {
      errors.push(`${fileNameOf(file, "relevé CA")}: seuls les relevés CA en image sont analysés pour l’instant.`);
      continue;
    }
    const result = await analyzeRevenueStatementImageFromBuffer(Buffer.from(await file.arrayBuffer()));
    if (result.error) errors.push(`${fileNameOf(file, "relevé CA")}: ${result.error}`);
    for (const row of result.suggestions) {
      const { error } = await supabaseServer.from("restaurant_monthly_revenues").upsert(
        {
          restaurant_id: restaurant.id,
          month: row.month,
          revenue_ttc: row.revenue_ttc,
          revenue_ht: row.revenue_ht,
          source_label: row.label ?? fileNameOf(file, "relevé CA"),
          notes: row.notes ?? null,
          analysis_result_json: {
            ...row,
            document_notes: result.document_notes ?? null,
            extraction_version: REVENUE_EXTRACTION_VERSION,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "restaurant_id,month" }
      );
      if (error) {
        errors.push(`${row.month}: import CA impossible (${error.message}).`);
      } else {
        revenueMonthsImported++;
      }
    }
  }

  return { revenueMonthsImported, errors };
}

/** Import CA uniquement — une ou plusieurs images par appel (préférez une image par requête côté client pour limiter la taille du FormData). */
export async function importOnboardingRevenueDocuments(formData: FormData): Promise<{
  ok: boolean;
  revenueMonthsImported: number;
  errors: string[];
}> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const revenueFiles = formData.getAll("revenue_statement_image").filter(isUsableFile);
  if (revenueFiles.length === 0) {
    return { ok: false, revenueMonthsImported: 0, errors: ["Aucune image de relevé CA."] };
  }

  const { revenueMonthsImported, errors } = await processRevenueStatementFiles(restaurant, revenueFiles);

  if (revenueMonthsImported > 0) {
    revalidatePath("/achats");
    revalidatePath("/dashboard");
  }

  return {
    ok: revenueMonthsImported > 0 || errors.length === 0,
    revenueMonthsImported,
    errors,
  };
}

export async function analyzeOnboardingImportDocuments(
  formData: FormData
): Promise<AnalyzeOnboardingImportsResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const menuBuffers = await getMenuImageBuffersFromFormData(formData);
  const recipeBuffers = await getImageBuffersFromFormData(formData, "recipe_image");
  const equipmentBuffers = await getImageBuffersFromFormData(formData, "equipment_image");
  if (menuBuffers.length === 0 && recipeBuffers.length === 0 && equipmentBuffers.length === 0) {
    return { ok: false, errors: ["Ajoutez au moins une photo de carte, de recette ou de matériel."] };
  }

  const errors: string[] = [];
  let menuSuggestions: MenuSuggestionItem[] | undefined;
  if (menuBuffers.length > 0) {
    const merged: MenuSuggestionItem[] = [];
    for (const buffer of menuBuffers) {
      const { suggestions, error } = await analyzeMenuImageFromBuffer(buffer);
      if (error) errors.push(error);
      merged.push(...suggestions);
    }
    menuSuggestions = mergeMenuSuggestionsByNormalizedLabel(merged);
  }

  let recipeSuggestions: RecipePhotoSuggestion[] | undefined;
  if (recipeBuffers.length > 0) {
    const merged: RecipePhotoSuggestion[] = [];
    for (const buffer of recipeBuffers) {
      const { suggestions, error } = await analyzeRecipeImageFromBuffer(buffer);
      if (error) errors.push(error);
      merged.push(...suggestions);
    }
    recipeSuggestions = merged;
  }

  let equipmentSuggestions: EquipmentInventorySuggestion[] | undefined;
  if (equipmentBuffers.length > 0) {
    const merged: EquipmentInventorySuggestion[] = [];
    for (const buffer of equipmentBuffers) {
      const { suggestions, error } = await analyzeEquipmentInventoryImageFromBuffer(buffer);
      if (error) errors.push(error);
      merged.push(...suggestions);
    }
    equipmentSuggestions = merged;
  }

  const hasSuggestions =
    (menuSuggestions?.length ?? 0) > 0 ||
    (recipeSuggestions?.length ?? 0) > 0 ||
    (equipmentSuggestions?.length ?? 0) > 0;
  return {
    ok: hasSuggestions || errors.length === 0,
    menuSuggestions,
    recipeSuggestions,
    equipmentSuggestions,
    errors,
  };
}

export async function importOnboardingBusinessDocuments(
  formData: FormData
): Promise<OnboardingBusinessImportsResult> {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const deliveryFiles = formData.getAll("delivery_note_file").filter(isUsableFile);
  const invoiceFiles = formData.getAll("supplier_invoice_file").filter(isUsableFile);

  if (deliveryFiles.length === 0 && invoiceFiles.length === 0) {
    return {
      ok: false,
      deliveryNotesCreated: 0,
      supplierInvoicesCreated: 0,
      revenueMonthsImported: 0,
      purchasePriceSuggestions: [],
      errors: ["Ajoutez au moins un bon de livraison ou une facture fournisseur."],
    };
  }

  const errors: string[] = [];
  let deliveryNotesCreated = 0;
  let supplierInvoicesCreated = 0;
  const purchasePriceSuggestions: PendingOnboardingPurchasePriceSuggestion[] = [];

  if (deliveryFiles.length > 0) {
    const supplier = await resolveSupplier(
      restaurant.id,
      String(formData.get("delivery_supplier_id") ?? ""),
      String(formData.get("delivery_supplier_name") ?? "")
    );
    if (!supplier.id) {
      errors.push(`BL : ${supplier.error}`);
    } else {
      for (const file of deliveryFiles) {
        const upload = await uploadFormFile({
          bucket: DELIVERY_NOTES_BUCKET,
          restaurantId: restaurant.id,
          folder: `onboarding-bl/${supplier.id}`,
          file,
          fallbackName: "bon-livraison.jpg",
        });
        if (upload.error) {
          errors.push(`${upload.fileName}: upload BL impossible (${upload.error}).`);
          continue;
        }
        const created = await createDeliveryNoteFromUpload({
          restaurantId: restaurant.id,
          supplierId: supplier.id,
          filePath: upload.path,
          fileName: upload.fileName,
          fileUrl: null,
        });
        if (created.error || !created.data) {
          errors.push(`${upload.fileName}: création BL impossible (${created.error?.message ?? "erreur inconnue"}).`);
          continue;
        }
        deliveryNotesCreated++;
        const analysis = await runDeliveryNoteAnalysis(created.data.id, restaurant.id);
        if (!analysis.ok) errors.push(`${upload.fileName}: analyse BL à vérifier (${analysis.error}).`);
      }
    }
  }

  if (invoiceFiles.length > 0) {
    const invoiceSupplierId = String(formData.get("invoice_supplier_id") ?? "").trim();
    const invoiceSupplierName = String(formData.get("invoice_supplier_name") ?? "").trim();
    const autoSupplierFromInvoice = !invoiceSupplierId && !invoiceSupplierName;

    if (!autoSupplierFromInvoice) {
      const supplier = await resolveSupplier(
        restaurant.id,
        invoiceSupplierId,
        invoiceSupplierName
      );
      if (!supplier.id) {
        errors.push(`Factures : ${supplier.error}`);
      } else {
        for (const file of invoiceFiles) {
          const upload = await uploadFormFile({
            bucket: SUPPLIER_INVOICES_BUCKET,
            restaurantId: restaurant.id,
            folder: `onboarding-invoices/${supplier.id}`,
            file,
            fallbackName: "facture-fournisseur.jpg",
          });
          if (upload.error) {
            errors.push(`${upload.fileName}: upload facture impossible (${upload.error}).`);
            continue;
          }
          const created = await createSupplierInvoice({
            restaurantId: restaurant.id,
            supplierId: supplier.id,
            filePath: upload.path,
            fileName: upload.fileName,
          });
          if (created.error || !created.data) {
            errors.push(`${upload.fileName}: création facture impossible (${created.error?.message ?? "erreur inconnue"}).`);
            continue;
          }
          supplierInvoicesCreated++;
          const analysis = await runSupplierInvoiceAnalysis(created.data.id, restaurant.id);
          if (!analysis.ok) errors.push(`${upload.fileName}: analyse facture à vérifier (${analysis.error}).`);
          purchasePriceSuggestions.push(
            ...(await collectPurchasePriceSuggestionsForInvoice({
              restaurantId: restaurant.id,
              invoiceId: created.data.id,
              supplierId: supplier.id,
            }))
          );
        }
      }
    } else {
      for (const file of invoiceFiles) {
        const upload = await uploadFormFile({
          bucket: SUPPLIER_INVOICES_BUCKET,
          restaurantId: restaurant.id,
          folder: "onboarding-invoices/auto",
          file,
          fallbackName: "facture-fournisseur.jpg",
        });
        if (upload.error) {
          errors.push(`${upload.fileName}: upload facture impossible (${upload.error}).`);
          continue;
        }

        const publicUrl = getSupplierInvoiceFileUrl(upload.path);
        if (!publicUrl) {
          errors.push(`${upload.fileName}: URL fichier introuvable.`);
          continue;
        }

        const outcome = await analyzeSupplierInvoiceDocument(publicUrl, upload.fileName);

        let vendorFromAnalysis = null;
        if (outcome.kind === "success") {
          const view = parseSupplierInvoiceAnalysis(outcome.result.json);
          vendorFromAnalysis = view?.vendor ?? null;
        }

        const resolved = await resolveOrCreateSupplierFromInvoiceVendor(
          restaurant.id,
          vendorFromAnalysis,
          upload.fileName
        );
        if ("error" in resolved) {
          errors.push(`${upload.fileName}: ${resolved.error}`);
          continue;
        }

        const created = await createSupplierInvoice({
          restaurantId: restaurant.id,
          supplierId: resolved.id,
          filePath: upload.path,
          fileName: upload.fileName,
        });
        if (created.error || !created.data) {
          errors.push(`${upload.fileName}: création facture impossible (${created.error?.message ?? "erreur inconnue"}).`);
          continue;
        }
        supplierInvoicesCreated++;

        await persistOnboardingInvoiceAnalysis(created.data.id, restaurant.id, outcome);

        if (outcome.kind === "error") {
          errors.push(`${upload.fileName}: analyse facture (${outcome.message})`);
        } else if (outcome.kind === "skipped_no_key") {
          errors.push(`${upload.fileName}: analyse automatique indisponible (${outcome.message})`);
        }

        purchasePriceSuggestions.push(
          ...(await collectPurchasePriceSuggestionsForInvoice({
            restaurantId: restaurant.id,
            invoiceId: created.data.id,
            supplierId: resolved.id,
          }))
        );
      }
    }
  }

  revalidatePath("/achats");
  revalidatePath("/livraison");
  revalidatePath("/supplier-invoices");
  revalidatePath("/dashboard");

  return {
    ok: deliveryNotesCreated + supplierInvoicesCreated > 0 || errors.length === 0,
    deliveryNotesCreated,
    supplierInvoicesCreated,
    revenueMonthsImported: 0,
    purchasePriceSuggestions,
    errors,
  };
}
