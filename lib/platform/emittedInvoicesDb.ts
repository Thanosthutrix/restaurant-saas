import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

export type PlatformCustomer = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  siret: string | null;
  vat_number: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformCompany = {
  id: string;
  legal_name: string;
  siret: string | null;
  siren: string | null;
  address: string | null;
  contact_email: string | null;
  vat_number: string | null;
};

export type EmittedInvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export type PlatformEmittedInvoice = {
  id: string;
  company_id: string;
  customer_id: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount_ht: number | null;
  amount_ttc: number | null;
  description: string | null;
  status: EmittedInvoiceStatus;
  source: "manual" | "pa_emission";
  pa_provider: string | null;
  pa_external_id: string | null;
  pa_lifecycle_status: string | null;
  pa_raw_payload: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EmittedInvoiceLine = {
  id: string;
  emitted_invoice_id: string;
  sort_order: number;
  label: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
  line_total: number;
};

export type EmittedInvoiceLineInput = {
  label: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatRate: number;
  lineTotal?: number;
};

const CUSTOMER_SELECT =
  "id, company_id, name, email, siret, vat_number, address, notes, created_at, updated_at";

const EMITTED_SELECT =
  "id, company_id, customer_id, customer_name, invoice_number, invoice_date, due_date, amount_ht, amount_ttc, description, status, source, pa_provider, pa_external_id, pa_lifecycle_status, pa_raw_payload, notes, created_at, updated_at";

export async function listPlatformCustomers(companyId: string): Promise<PlatformCustomer[]> {
  const { data, error } = await supabaseServer
    .from("platform_customers")
    .select(CUSTOMER_SELECT)
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as PlatformCustomer[];
}

export async function getPlatformCustomer(customerId: string): Promise<PlatformCustomer | null> {
  const { data, error } = await supabaseServer
    .from("platform_customers")
    .select(CUSTOMER_SELECT)
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlatformCustomer | null) ?? null;
}

export async function createPlatformCustomer(params: {
  companyId: string;
  name: string;
  email?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<PlatformCustomer> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("platform_customers")
    .insert({
      company_id: params.companyId,
      name: params.name.trim(),
      email: params.email?.trim() || null,
      siret: params.siret?.replace(/\D/g, "") || null,
      vat_number: params.vatNumber?.trim() || null,
      address: params.address?.trim() || null,
      notes: params.notes?.trim() || null,
      updated_at: now,
    })
    .select(CUSTOMER_SELECT)
    .single();
  if (error || !data) throw error ?? new Error("Création client impossible.");
  return data as PlatformCustomer;
}

export async function listPlatformEmittedInvoices(companyId: string): Promise<PlatformEmittedInvoice[]> {
  const { data, error } = await supabaseServer
    .from("platform_emitted_invoices")
    .select(EMITTED_SELECT)
    .eq("company_id", companyId)
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlatformEmittedInvoice[];
}

export async function getPlatformEmittedInvoice(id: string): Promise<PlatformEmittedInvoice | null> {
  const { data, error } = await supabaseServer
    .from("platform_emitted_invoices")
    .select(EMITTED_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as PlatformEmittedInvoice | null) ?? null;
}

export async function listEmittedInvoiceLines(emittedInvoiceId: string): Promise<EmittedInvoiceLine[]> {
  const { data, error } = await supabaseServer
    .from("platform_emitted_invoice_lines")
    .select("id, emitted_invoice_id, sort_order, label, quantity, unit, unit_price, vat_rate, line_total")
    .eq("emitted_invoice_id", emittedInvoiceId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...(row as EmittedInvoiceLine),
    quantity: Number((row as EmittedInvoiceLine).quantity),
    unit_price: Number((row as EmittedInvoiceLine).unit_price),
    vat_rate: Number((row as EmittedInvoiceLine).vat_rate),
    line_total: Number((row as EmittedInvoiceLine).line_total),
  }));
}

export async function replaceEmittedInvoiceLines(
  emittedInvoiceId: string,
  lines: EmittedInvoiceLineInput[]
): Promise<void> {
  await supabaseServer.from("platform_emitted_invoice_lines").delete().eq("emitted_invoice_id", emittedInvoiceId);
  if (!lines.length) return;

  const rows = lines.map((line, index) => {
    const net = line.lineTotal ?? line.quantity * line.unitPrice;
    return {
      emitted_invoice_id: emittedInvoiceId,
      sort_order: index,
      label: line.label.trim(),
      quantity: line.quantity,
      unit: line.unit?.trim() || "C62",
      unit_price: line.unitPrice,
      vat_rate: line.vatRate,
      line_total: Math.round(net * 100) / 100,
    };
  });

  const { error } = await supabaseServer.from("platform_emitted_invoice_lines").insert(rows);
  if (error) throw error;
}

export async function createPlatformEmittedInvoice(params: {
  companyId: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  description?: string | null;
  amountHt: number;
  amountTtc: number;
  lines: EmittedInvoiceLineInput[];
}): Promise<PlatformEmittedInvoice> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("platform_emitted_invoices")
    .insert({
      company_id: params.companyId,
      customer_id: params.customerId,
      customer_name: params.customerName,
      invoice_number: params.invoiceNumber.trim(),
      invoice_date: params.invoiceDate,
      due_date: params.dueDate || null,
      description: params.description?.trim() || null,
      amount_ht: params.amountHt,
      amount_ttc: params.amountTtc,
      status: "draft",
      source: "manual",
      updated_at: now,
    })
    .select(EMITTED_SELECT)
    .single();
  if (error || !data) throw error ?? new Error("Création facture impossible.");

  await replaceEmittedInvoiceLines((data as PlatformEmittedInvoice).id, params.lines);
  return data as PlatformEmittedInvoice;
}

export async function updatePlatformEmittedInvoiceAfterPaEmit(
  invoiceId: string,
  patch: {
    paProvider: string;
    paExternalId: string;
    paLifecycleStatus: string | null;
    paRawPayload: unknown;
    amountHt: number;
    amountTtc: number;
  }
): Promise<void> {
  const { error } = await supabaseServer
    .from("platform_emitted_invoices")
    .update({
      status: "sent",
      source: "pa_emission",
      pa_provider: patch.paProvider,
      pa_external_id: patch.paExternalId,
      pa_lifecycle_status: patch.paLifecycleStatus,
      pa_raw_payload: patch.paRawPayload,
      amount_ht: patch.amountHt,
      amount_ttc: patch.amountTtc,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (error) throw error;
}

export async function getPlatformCompanyForEmit(companyId: string): Promise<PlatformCompany | null> {
  const { data, error } = await supabaseServer
    .from("platform_companies")
    .select("id, legal_name, siret, siren, address, contact_email, vat_number")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlatformCompany | null) ?? null;
}

export async function countDraftEmittedInvoices(companyId: string): Promise<number> {
  const { count, error } = await supabaseServer
    .from("platform_emitted_invoices")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "draft");
  if (error) throw error;
  return count ?? 0;
}

export function suggestInvoiceNumber(prefix = "FAC"): string {
  const year = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-6);
  return `${prefix}-${year}-${suffix}`;
}

export function linesFromDbRows(rows: EmittedInvoiceLine[]): EmittedInvoiceLineInput[] {
  return rows.map((row) => ({
    label: row.label,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unit_price,
    vatRate: row.vat_rate,
    lineTotal: row.line_total,
  }));
}
