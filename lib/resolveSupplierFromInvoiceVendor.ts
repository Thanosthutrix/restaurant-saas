import { createSupplier, getSuppliers, type Supplier } from "@/lib/db";
import type { SupplierInvoiceVendorHint } from "@/lib/supplier-invoice-analysis";

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(s: string): Set<string> {
  return new Set(
    normalizeKey(s)
      .split(" ")
      .filter((w) => w.length >= 3)
  );
}

function tokensOverlapScore(a: string, b: string): number {
  const A = significantTokens(a);
  const B = significantTokens(b);
  let n = 0;
  for (const t of A) {
    if (B.has(t)) {
      n++;
      continue;
    }
    for (const u of B) {
      if (u.includes(t) || t.includes(u)) {
        n++;
        break;
      }
    }
  }
  return n;
}

function matchSupplierByVendor(list: Supplier[], vendor: SupplierInvoiceVendorHint | null): string | null {
  if (!vendor) return null;

  const siret = vendor.siret?.replace(/\s/g, "") ?? "";
  if (siret.length >= 9) {
    for (const s of list) {
      const notes = s.notes?.replace(/\s/g, "") ?? "";
      if (notes.includes(siret)) return s.id;
    }
  }

  const legal = vendor.legal_name?.trim() ?? "";
  if (!legal) return null;

  const nk = normalizeKey(legal);
  for (const s of list) {
    const sk = normalizeKey(s.name);
    if (sk === nk) return s.id;
    if (sk.length >= 10 && nk.length >= 10 && (sk.includes(nk) || nk.includes(sk))) return s.id;
    const score = tokensOverlapScore(legal, s.name);
    if (score >= 2) return s.id;
    if (
      score >= 1 &&
      significantTokens(legal).size <= 2 &&
      significantTokens(s.name).size <= 2 &&
      Math.max(legal.length, s.name.length) >= 6
    ) {
      return s.id;
    }
  }
  return null;
}

function fallbackNameFromFileLabel(fileLabel: string): string {
  const base = fileLabel.replace(/\.[^.]+$/i, "").replace(/[_-]+/g, " ").trim();
  return base.length ? base.slice(0, 120) : "import";
}

/**
 * Rapproche un fournisseur existant (nom / SIRET dans les notes / similarité de libellé)
 * ou en crée un à partir des infos lues sur la facture.
 */
export async function resolveOrCreateSupplierFromInvoiceVendor(
  restaurantId: string,
  vendor: SupplierInvoiceVendorHint | null,
  fileNameForFallback: string
): Promise<{ id: string } | { error: string }> {
  const { data: suppliers, error } = await getSuppliers(restaurantId, true);
  if (error) return { error: error.message };
  const list = suppliers ?? [];

  const matched = matchSupplierByVendor(list, vendor);
  if (matched) return { id: matched };

  const fallback = fallbackNameFromFileLabel(fileNameForFallback);
  const base =
    vendor?.legal_name?.trim() ||
    (fallback.length ? `Fournisseur — ${fallback}` : null) ||
    "Fournisseur (import)";
  const name = base.slice(0, 200);

  const created = await createSupplier({
    restaurant_id: restaurantId,
    name: name,
    email: vendor?.email?.trim() || null,
    phone: vendor?.phone?.trim() || null,
    address: vendor?.address?.trim() || null,
    notes: null,
    preferred_order_method: "EMAIL",
    order_days: [],
    is_active: true,
  });
  if (created.error || !created.data) {
    return { error: created.error?.message ?? "Création du fournisseur impossible." };
  }
  return { id: created.data.id };
}
