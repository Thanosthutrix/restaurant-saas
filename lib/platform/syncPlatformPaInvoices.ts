import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { PA_ACTIVE_PROVIDER } from "@/lib/pa/config";
import type { SupplierInvoiceAnalysisLine } from "@/lib/supplier-invoice-analysis";
import { createPlatformInvoice } from "@/lib/platform/companyInvoicesDb";
import { resolveOrCreatePlatformSupplier } from "@/lib/platform/companyDb";
import {
  getPlatformPaConnection,
  upsertPlatformPaConnection,
} from "@/lib/platform/platformPaDb";
import { platformPaApiFetch } from "@/lib/platform/platformPaApi";
import { replacePlatformInvoiceExtractedLines } from "@/lib/platform/runPlatformInvoiceAnalysis";
import { guessPlatformExpenseCategory } from "@/lib/platform/platformExpenseCategories";

type PaInvoiceOverview = {
  id: number;
  company_id: number;
  direction: "in" | "out";
  events?: { status_code: string }[];
  en_invoice?: {
    number?: string;
    issue_date?: string;
    seller?: {
      name?: string;
      vat_identifier?: string;
      legal_registration_identifier?: { value: string };
      postal_address?: { address_line1?: string; post_code?: string; city?: string; country_code?: string };
      contact?: { email_address?: string };
    };
    totals?: { total_without_vat?: string; total_with_vat?: string };
    lines?: {
      net_amount?: string;
      invoiced_quantity?: string;
      invoiced_quantity_code?: string;
      item_information?: { name?: string; description?: string };
      price_details?: { item_net_price?: string };
    }[];
  };
};

type PaInvoiceList = { data: PaInvoiceOverview[]; has_after: boolean };

function toNumber(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatVendorAddress(
  addr: { address_line1?: string; post_code?: string; city?: string; country_code?: string } | undefined
): string | null {
  if (!addr) return null;
  const parts = [addr.address_line1, addr.post_code, addr.city, addr.country_code].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function mapPaLines(
  lines: NonNullable<NonNullable<PaInvoiceOverview["en_invoice"]>["lines"]>
): SupplierInvoiceAnalysisLine[] {
  if (!lines?.length) return [];
  return lines.map((l) => ({
    label: l.item_information?.name || l.item_information?.description || "—",
    quantity: toNumber(l.invoiced_quantity),
    unit: l.invoiced_quantity_code ?? null,
    unit_price: toNumber(l.price_details?.item_net_price),
    line_total: toNumber(l.net_amount),
  }));
}

function buildAnalysisResultJson(inv: PaInvoiceOverview, amountHt: number | null, amountTtc: number | null) {
  const en = inv.en_invoice;
  return {
    invoice_number: en?.number ?? null,
    invoice_date: en?.issue_date ?? null,
    amount_ht: amountHt,
    amount_ttc: amountTtc,
    vendor: {
      legal_name: en?.seller?.name ?? null,
      vat_number: en?.seller?.vat_identifier ?? null,
      siret: en?.seller?.legal_registration_identifier?.value ?? null,
      address: formatVendorAddress(en?.seller?.postal_address),
      email: en?.seller?.contact?.email_address ?? null,
    },
    lines: mapPaLines(en?.lines),
    source: "pa_reception",
  };
}

export type PlatformSyncResult = { fetched: number; created: number; skipped: number; error?: string };

export async function syncPlatformPaInvoices(companyId: string): Promise<PlatformSyncResult> {
  const conn = await getPlatformPaConnection(companyId);
  if (!conn?.provider_company_id) {
    return { fetched: 0, created: 0, skipped: 0, error: "Société non connectée à la PA." };
  }

  let fetched = 0;
  let created = 0;
  let skipped = 0;
  let cursor: number | null = null;

  try {
    for (;;) {
      const params = new URLSearchParams({ direction: "in", limit: "100" });
      if (cursor != null) params.set("starting_after_id", String(cursor));
      for (const field of ["en_invoice", "en_invoice.seller", "en_invoice.lines", "events"]) {
        params.append("expand[]", field);
      }

      const res = await platformPaApiFetch(companyId, `/v1.beta/invoices?${params.toString()}`);
      if (!res.ok) throw new Error(`GET /invoices → ${res.status}`);
      const page = (await res.json()) as PaInvoiceList;

      for (const inv of page.data) {
        fetched++;
        if (String(inv.company_id) !== conn.provider_company_id) {
          skipped++;
          continue;
        }
        const wasCreated = await upsertPlatformPaInvoice(companyId, inv);
        if (wasCreated) created++;
        else skipped++;
      }

      if (!page.has_after || page.data.length === 0) break;
      cursor = page.data[page.data.length - 1].id;
    }

    await upsertPlatformPaConnection(companyId, {
      last_invoice_received_at: new Date().toISOString(),
      last_error: null,
    });
    return { fetched, created, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertPlatformPaConnection(companyId, { last_error: message });
    return { fetched, created, skipped, error: message };
  }
}

async function upsertPlatformPaInvoice(companyId: string, inv: PaInvoiceOverview): Promise<boolean> {
  const externalId = String(inv.id);
  const { data: existing } = await supabaseServer
    .from("platform_invoices")
    .select("id")
    .eq("pa_provider", PA_ACTIVE_PROVIDER)
    .eq("pa_external_id", externalId)
    .maybeSingle();

  const en = inv.en_invoice;
  const lastEvent = inv.events?.length ? inv.events[inv.events.length - 1] : null;
  const amountHt = toNumber(en?.totals?.total_without_vat);
  const amountTtc = toNumber(en?.totals?.total_with_vat);
  const analysisJson = buildAnalysisResultJson(inv, amountHt, amountTtc);
  const vendorName = en?.seller?.name ?? `facture-pa-${externalId}`;

  if (existing) {
    const existingId = (existing as { id: string }).id;
    await supabaseServer
      .from("platform_invoices")
      .update({
        pa_lifecycle_status: lastEvent?.status_code ?? null,
        pa_raw_payload: inv,
        analysis_result_json: analysisJson,
        analysis_status: "done",
        ...(amountHt != null ? { amount_ht: amountHt } : {}),
        ...(amountTtc != null ? { amount_ttc: amountTtc } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingId);
    await replacePlatformInvoiceExtractedLines(existingId, mapPaLines(en?.lines));
    return false;
  }

  const supplier = await resolveOrCreatePlatformSupplier(
    companyId,
    {
      legal_name: en?.seller?.name ?? null,
      email: en?.seller?.contact?.email_address ?? null,
      siret: en?.seller?.legal_registration_identifier?.value ?? null,
    },
    vendorName
  );

  const invoice = await createPlatformInvoice({
    companyId,
    supplierId: supplier.id,
    supplierName: supplier.name,
    invoiceNumber: en?.number ?? null,
    invoiceDate: en?.issue_date ?? null,
    amountHt,
    amountTtc,
    expenseCategory: guessPlatformExpenseCategory(vendorName),
  });

  await supabaseServer
    .from("platform_invoices")
    .update({
      source: "pa_reception",
      pa_provider: PA_ACTIVE_PROVIDER,
      pa_external_id: externalId,
      pa_lifecycle_status: lastEvent?.status_code ?? null,
      pa_raw_payload: inv,
      analysis_status: "done",
      analysis_result_json: analysisJson,
      file_name: en?.number ? `${en.number}.json` : `facture-pa-${externalId}.json`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);

  await replacePlatformInvoiceExtractedLines(invoice.id, mapPaLines(en?.lines));
  return true;
}
