import { getSupplier, updateSupplier, type UpdateSupplierPayload } from "@/lib/db";
import type { SupplierInvoiceVendorHint } from "@/lib/supplier-invoice-analysis";

function isEmptyText(v: string | null | undefined): boolean {
  return v == null || String(v).trim() === "";
}

/**
 * Complète la fiche fournisseur avec ce qui a été lu sur la facture (ne remplace pas ce que l’utilisateur a déjà saisi).
 * Ajoute SIRET / TVA / raison sociale en notes si utile.
 */
export async function applyVendorHintsFromInvoiceAnalysis(
  supplierId: string,
  restaurantId: string,
  vendor: SupplierInvoiceVendorHint | null
): Promise<void> {
  if (!vendor) return;

  const { data: sup, error } = await getSupplier(supplierId);
  if (error || !sup || sup.restaurant_id !== restaurantId) return;

  const payload: UpdateSupplierPayload = {};
  if (!isEmptyText(vendor.email) && isEmptyText(sup.email)) {
    payload.email = vendor.email!.trim();
  }
  if (!isEmptyText(vendor.phone) && isEmptyText(sup.phone)) {
    payload.phone = vendor.phone!.trim();
  }
  if (!isEmptyText(vendor.address) && isEmptyText(sup.address)) {
    payload.address = vendor.address!.trim();
  }

  const noteLines: string[] = [];
  if (!isEmptyText(vendor.legal_name)) {
    noteLines.push(`Raison sociale (facture) : ${vendor.legal_name!.trim()}`);
  }
  if (!isEmptyText(vendor.siret)) {
    noteLines.push(`SIRET : ${vendor.siret!.trim()}`);
  }
  if (!isEmptyText(vendor.vat_number)) {
    noteLines.push(`N° TVA intracommunautaire : ${vendor.vat_number!.trim()}`);
  }

  if (noteLines.length > 0) {
    const block = noteLines.join("\n");
    const existing = sup.notes?.trim() ?? "";
    const compactExisting = existing.replace(/\s+/g, " ");
    const compactBlock = block.replace(/\s+/g, " ");
    const alreadyThere =
      compactExisting.includes(compactBlock.slice(0, Math.min(40, compactBlock.length))) ||
      (!isEmptyText(vendor.siret) && existing.includes(vendor.siret!.trim()));
    if (!alreadyThere) {
      payload.notes = existing ? `${existing}\n\n--- Extrait facture (IA) ---\n${block}` : block;
    }
  }

  if (Object.keys(payload).length === 0) return;

  await updateSupplier(supplierId, payload);
}
