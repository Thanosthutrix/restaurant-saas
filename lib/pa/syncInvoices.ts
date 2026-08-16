import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { createSupplierInvoice } from "@/lib/db";
import { resolveOrCreateSupplierFromInvoiceVendor } from "@/lib/resolveSupplierFromInvoiceVendor";
import { PA_ACTIVE_PROVIDER } from "./config";
import { paApiFetch } from "./apiClient";
import { getPaConnection, upsertPaConnection } from "./paDb";

/** Sous-ensemble de l'invoice_overview Super PDP (EN 16931) utile à l'ingestion. */
type PaInvoiceOverview = {
  id: number;
  company_id: number;
  direction: "in" | "out";
  created_at: string;
  events?: { status_code: string; status_text: string; created_at: string }[];
  en_invoice?: {
    number?: string;
    issue_date?: string;
    seller?: {
      name?: string;
      vat_identifier?: string;
      legal_registration_identifier?: { scheme: string; value: string };
      postal_address?: { address_line1?: string; post_code?: string; city?: string; country_code?: string };
      contact?: { email_address?: string };
    };
    totals?: { total_without_vat?: string; total_with_vat?: string };
  };
};

type PaInvoiceList = { count: number; data: PaInvoiceOverview[]; has_after: boolean; has_before: boolean };

function toNumber(decimalString: string | undefined): number | null {
  if (!decimalString) return null;
  const n = Number(decimalString);
  return Number.isFinite(n) ? n : null;
}

type PaPostalAddress = { address_line1?: string; post_code?: string; city?: string; country_code?: string };

function formatVendorAddress(addr: PaPostalAddress | undefined): string | null {
  if (!addr) return null;
  const parts = [addr.address_line1, addr.post_code, addr.city, addr.country_code].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export type SyncResult = { fetched: number; created: number; skipped: number; error?: string };

/**
 * Récupère les factures reçues (direction=in) pour un restaurant connecté et les fait
 * apparaître dans supplier_invoices. Idempotent : une facture déjà importée (même
 * pa_external_id) n'est pas recréée.
 */
export async function syncPaInvoicesForRestaurant(restaurantId: string): Promise<SyncResult> {
  const conn = await getPaConnection(restaurantId);
  if (!conn?.provider_company_id) {
    return { fetched: 0, created: 0, skipped: 0, error: "Restaurant non connecté à la PA." };
  }

  let fetched = 0;
  let created = 0;
  let skipped = 0;
  let cursor: number | null = null;

  try {
    // Pagination par curseur (starting_after_id) : on avance tant qu'il reste des pages.
    for (;;) {
      const params = new URLSearchParams({ direction: "in", limit: "100" });
      if (cursor != null) params.set("starting_after_id", String(cursor));

      const res = await paApiFetch(restaurantId, `/v1.beta/invoices?${params.toString()}`);
      if (!res.ok) throw new Error(`GET /invoices → ${res.status}`);
      const page = (await res.json()) as PaInvoiceList;

      for (const inv of page.data) {
        fetched++;
        // Une Application peut voir plusieurs entreprises en sandbox : on ne garde que
        // les factures de l'entreprise réellement connectée à ce restaurant.
        if (String(inv.company_id) !== conn.provider_company_id) {
          skipped++;
          continue;
        }
        const wasCreated = await upsertOneInvoice(restaurantId, inv);
        if (wasCreated) created++;
        else skipped++;
      }

      if (!page.has_after || page.data.length === 0) break;
      cursor = page.data[page.data.length - 1].id;
    }

    await upsertPaConnection(restaurantId, {
      last_invoice_received_at: new Date().toISOString(),
      last_error: null,
    });
    return { fetched, created, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertPaConnection(restaurantId, { last_error: message });
    return { fetched, created, skipped, error: message };
  }
}

async function upsertOneInvoice(restaurantId: string, inv: PaInvoiceOverview): Promise<boolean> {
  const externalId = String(inv.id);

  const { data: existing } = await supabaseServer
    .from("supplier_invoices")
    .select("id")
    .eq("pa_provider", PA_ACTIVE_PROVIDER)
    .eq("pa_external_id", externalId)
    .maybeSingle();

  const en = inv.en_invoice;
  const lastEvent = inv.events?.length ? inv.events[inv.events.length - 1] : null;
  const amountHt = toNumber(en?.totals?.total_without_vat);
  const amountTtc = toNumber(en?.totals?.total_with_vat);

  if (existing) {
    // Facture déjà connue : on rafraîchit juste le statut de cycle de vie et le brut.
    await supabaseServer
      .from("supplier_invoices")
      .update({
        pa_lifecycle_status: lastEvent?.status_code ?? null,
        pa_raw_payload: inv,
        ...(amountHt != null ? { amount_ht: amountHt } : {}),
        ...(amountTtc != null ? { amount_ttc: amountTtc } : {}),
      })
      .eq("id", (existing as { id: string }).id);
    return false;
  }

  const supplier = await resolveOrCreateSupplierFromInvoiceVendor(
    restaurantId,
    {
      legal_name: en?.seller?.name ?? null,
      address: formatVendorAddress(en?.seller?.postal_address),
      email: en?.seller?.contact?.email_address ?? null,
      phone: null,
      vat_number: en?.seller?.vat_identifier ?? null,
      // Le schéma exact du code (SIRET vs autre identifiant ISO 6523) n'est pas garanti ici ;
      // matchSupplierByVendor ne s'en sert que pour un rapprochement approximatif, sans risque.
      siret: en?.seller?.legal_registration_identifier?.value ?? null,
    },
    en?.number ?? `facture-pa-${externalId}`
  );
  if ("error" in supplier) throw new Error(supplier.error);

  const createdInvoice = await createSupplierInvoice({
    restaurantId,
    supplierId: supplier.id,
    invoiceNumber: en?.number ?? null,
    invoiceDate: en?.issue_date ?? null,
    filePath: null,
    fileName: en?.number ? `${en.number}.json` : `facture-pa-${externalId}.json`,
  });
  if (createdInvoice.error || !createdInvoice.data) {
    throw new Error(createdInvoice.error?.message ?? "Création de la facture impossible.");
  }

  await supabaseServer
    .from("supplier_invoices")
    .update({
      source: "pa_reception",
      pa_provider: PA_ACTIVE_PROVIDER,
      pa_external_id: externalId,
      pa_format: null, // l'API normalise en EN 16931 quel que soit le format d'origine
      pa_lifecycle_status: lastEvent?.status_code ?? null,
      pa_raw_payload: inv,
      amount_ht: amountHt,
      amount_ttc: amountTtc,
    })
    .eq("id", createdInvoice.data.id);

  return true;
}
