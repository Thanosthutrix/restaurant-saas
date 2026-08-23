import "server-only";

import { PA_ACTIVE_PROVIDER } from "@/lib/pa/config";
import { buildEn16931Invoice, totalsFromLines, type En16931Invoice } from "@/lib/platform/buildEn16931Invoice";
import {
  getPlatformCompanyForEmit,
  getPlatformCustomer,
  getPlatformEmittedInvoice,
  linesFromDbRows,
  listEmittedInvoiceLines,
  updatePlatformEmittedInvoiceAfterPaEmit,
  type EmittedInvoiceLineInput,
} from "@/lib/platform/emittedInvoicesDb";
import { platformPaApiFetch } from "@/lib/platform/platformPaApi";
import { getPlatformPaConnection } from "@/lib/platform/platformPaDb";

type PaCreatedInvoice = {
  id: number;
  company_id: number;
  direction: "out";
  events?: { status_code: string }[];
  en_invoice?: En16931Invoice;
};

async function convertEn16931ToCiiXml(companyId: string, invoice: En16931Invoice): Promise<string> {
  const res = await platformPaApiFetch(
    companyId,
    "/v1.beta/invoices/convert?from=en16931&to=cii",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/xml" },
      body: JSON.stringify(invoice),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Conversion EN16931 → CII échouée (${res.status}) : ${text.slice(0, 400)}`);
  }
  return res.text();
}

async function postCiiInvoice(companyId: string, xml: string): Promise<PaCreatedInvoice> {
  const res = await platformPaApiFetch(companyId, "/v1.beta/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/xml", Accept: "application/json" },
    body: xml,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Envoi PA échoué (${res.status}) : ${text.slice(0, 400)}`);
  }
  return (await res.json()) as PaCreatedInvoice;
}

export type EmitPlatformPaInvoiceResult =
  | { ok: true; paInvoiceId: number; lifecycleStatus: string | null }
  | { ok: false; error: string };

export async function emitPlatformPaInvoice(emittedInvoiceId: string): Promise<EmitPlatformPaInvoiceResult> {
  const invoice = await getPlatformEmittedInvoice(emittedInvoiceId);
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (invoice.status !== "draft") return { ok: false, error: "Seuls les brouillons peuvent être émis." };
  if (invoice.pa_external_id) return { ok: false, error: "Facture déjà envoyée à la PA." };

  const conn = await getPlatformPaConnection(invoice.company_id);
  if (!conn?.provider_company_id || !conn.access_token) {
    return { ok: false, error: "Société non connectée à la PA." };
  }

  const [company, customer, dbLines] = await Promise.all([
    getPlatformCompanyForEmit(invoice.company_id),
    invoice.customer_id ? getPlatformCustomer(invoice.customer_id) : null,
    listEmittedInvoiceLines(emittedInvoiceId),
  ]);

  if (!company) return { ok: false, error: "Profil société incomplet." };
  if (!customer) return { ok: false, error: "Client introuvable." };
  if (!company.siret?.trim()) return { ok: false, error: "SIRET société requis pour l'émission PA." };
  if (!customer.siret?.trim()) return { ok: false, error: "SIRET client requis pour l'émission PA." };

  const lines: EmittedInvoiceLineInput[] = dbLines.length
    ? linesFromDbRows(dbLines)
    : invoice.description
      ? [{ label: invoice.description, quantity: 1, unitPrice: invoice.amount_ht ?? 0, vatRate: 20 }]
      : [];

  if (!lines.length) return { ok: false, error: "Ajoutez au moins une ligne à la facture." };

  const invoiceNumber = invoice.invoice_number?.trim();
  const issueDate = invoice.invoice_date;
  if (!invoiceNumber || !issueDate) {
    return { ok: false, error: "Numéro et date de facture requis." };
  }

  try {
    const enInvoice = buildEn16931Invoice({
      company,
      customer,
      invoiceNumber,
      issueDate,
      dueDate: invoice.due_date,
      lines,
    });

    const ciiXml = await convertEn16931ToCiiXml(invoice.company_id, enInvoice);
    const created = await postCiiInvoice(invoice.company_id, ciiXml);
    const totals = totalsFromLines(lines);
    const lastEvent = created.events?.length ? created.events[created.events.length - 1] : null;

    await updatePlatformEmittedInvoiceAfterPaEmit(emittedInvoiceId, {
      paProvider: PA_ACTIVE_PROVIDER,
      paExternalId: String(created.id),
      paLifecycleStatus: lastEvent?.status_code ?? null,
      paRawPayload: created,
      amountHt: totals.amountHt,
      amountTtc: totals.amountTtc,
    });

    return { ok: true, paInvoiceId: created.id, lifecycleStatus: lastEvent?.status_code ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
