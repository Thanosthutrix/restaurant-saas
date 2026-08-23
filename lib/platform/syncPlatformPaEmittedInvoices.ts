import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { PA_ACTIVE_PROVIDER } from "@/lib/pa/config";
import {
  getPlatformPaConnection,
  upsertPlatformPaConnection,
} from "@/lib/platform/platformPaDb";
import { platformPaApiFetch } from "@/lib/platform/platformPaApi";

type PaInvoiceOverview = {
  id: number;
  company_id: number;
  direction: "in" | "out";
  events?: { status_code: string }[];
  en_invoice?: {
    number?: string;
    issue_date?: string;
    totals?: { total_without_vat?: string; total_with_vat?: string };
    buyer?: { name?: string };
  };
};

type PaInvoiceList = { data: PaInvoiceOverview[]; has_after: boolean };

function toNumber(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type PlatformEmittedSyncResult = { fetched: number; updated: number; skipped: number; error?: string };

export async function syncPlatformPaEmittedInvoices(companyId: string): Promise<PlatformEmittedSyncResult> {
  const conn = await getPlatformPaConnection(companyId);
  if (!conn?.provider_company_id) {
    return { fetched: 0, updated: 0, skipped: 0, error: "Société non connectée à la PA." };
  }

  let fetched = 0;
  let updated = 0;
  let skipped = 0;
  let cursor: number | null = null;

  try {
    for (;;) {
      const params = new URLSearchParams({ direction: "out", limit: "100" });
      if (cursor != null) params.set("starting_after_id", String(cursor));
      for (const field of ["en_invoice", "en_invoice.buyer", "events"]) {
        params.append("expand[]", field);
      }

      const res = await platformPaApiFetch(companyId, `/v1.beta/invoices?${params.toString()}`);
      if (!res.ok) throw new Error(`GET /invoices (out) → ${res.status}`);
      const page = (await res.json()) as PaInvoiceList;

      for (const inv of page.data) {
        fetched++;
        if (String(inv.company_id) !== conn.provider_company_id) {
          skipped++;
          continue;
        }
        const wasUpdated = await upsertPlatformPaEmittedInvoice(companyId, inv);
        if (wasUpdated) updated++;
        else skipped++;
      }

      if (!page.has_after || page.data.length === 0) break;
      cursor = page.data[page.data.length - 1].id;
    }

    await upsertPlatformPaConnection(companyId, {
      last_invoice_emitted_at: new Date().toISOString(),
      last_error: null,
    });
    return { fetched, updated, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await upsertPlatformPaConnection(companyId, { last_error: message });
    return { fetched, updated, skipped, error: message };
  }
}

async function upsertPlatformPaEmittedInvoice(companyId: string, inv: PaInvoiceOverview): Promise<boolean> {
  const externalId = String(inv.id);
  const lastEvent = inv.events?.length ? inv.events[inv.events.length - 1] : null;
  const en = inv.en_invoice;
  const amountHt = toNumber(en?.totals?.total_without_vat);
  const amountTtc = toNumber(en?.totals?.total_with_vat);

  const { data: existing } = await supabaseServer
    .from("platform_emitted_invoices")
    .select("id, status")
    .eq("pa_provider", PA_ACTIVE_PROVIDER)
    .eq("pa_external_id", externalId)
    .maybeSingle();

  if (existing) {
    const existingId = (existing as { id: string; status: string }).id;
    await supabaseServer
      .from("platform_emitted_invoices")
      .update({
        pa_lifecycle_status: lastEvent?.status_code ?? null,
        pa_raw_payload: inv,
        customer_name: en?.buyer?.name ?? undefined,
        invoice_number: en?.number ?? undefined,
        invoice_date: en?.issue_date ?? undefined,
        ...(amountHt != null ? { amount_ht: amountHt } : {}),
        ...(amountTtc != null ? { amount_ttc: amountTtc } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingId);
    return true;
  }

  await supabaseServer.from("platform_emitted_invoices").insert({
    company_id: companyId,
    customer_name: en?.buyer?.name ?? "Client PA",
    invoice_number: en?.number ?? null,
    invoice_date: en?.issue_date ?? null,
    amount_ht: amountHt,
    amount_ttc: amountTtc,
    status: "sent",
    source: "pa_emission",
    pa_provider: PA_ACTIVE_PROVIDER,
    pa_external_id: externalId,
    pa_lifecycle_status: lastEvent?.status_code ?? null,
    pa_raw_payload: inv,
  });
  return true;
}
