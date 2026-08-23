"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import { emitPlatformPaInvoice } from "@/lib/platform/emitPlatformPaInvoice";
import {
  createPlatformCustomer,
  createPlatformEmittedInvoice,
  suggestInvoiceNumber,
  type EmittedInvoiceLineInput,
} from "@/lib/platform/emittedInvoicesDb";
import { totalsFromLines } from "@/lib/platform/buildEn16931Invoice";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function gateAdmin(): Promise<ActionResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès refusé." };
  return { ok: true };
}

function parseLines(raw: {
  label: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}[]): EmittedInvoiceLineInput[] {
  return raw
    .filter((l) => l.label.trim())
    .map((l) => ({
      label: l.label.trim(),
      quantity: Number(l.quantity) || 1,
      unitPrice: Number(l.unitPrice) || 0,
      vatRate: Number(l.vatRate) ?? 20,
    }));
}

export async function createPlatformCustomerAction(params: {
  name: string;
  email?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  address?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;

  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Configurez d'abord le profil de votre société." };
  if (!params.name.trim()) return { ok: false, error: "Nom client requis." };

  try {
    const customer = await createPlatformCustomer({
      companyId: company.id,
      name: params.name,
      email: params.email,
      siret: params.siret,
      vatNumber: params.vatNumber,
      address: params.address,
    });
    revalidatePath("/admin/company/emitted");
    return { ok: true, data: { id: customer.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createPlatformEmittedInvoiceAction(params: {
  customerId: string;
  invoiceNumber?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  description?: string | null;
  lines: { label: string; quantity: number; unitPrice: number; vatRate: number }[];
}): Promise<ActionResult<{ id: string }>> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;

  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Configurez d'abord le profil de votre société." };

  const lines = parseLines(params.lines);
  if (!lines.length) return { ok: false, error: "Ajoutez au moins une ligne." };

  const { supabaseServer } = await import("@/lib/supabaseServer");
  const { data: customer } = await supabaseServer
    .from("platform_customers")
    .select("id, name")
    .eq("id", params.customerId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!customer) return { ok: false, error: "Client introuvable." };

  const totals = totalsFromLines(lines);
  const invoiceNumber = params.invoiceNumber?.trim() || suggestInvoiceNumber();

  try {
    const invoice = await createPlatformEmittedInvoice({
      companyId: company.id,
      customerId: params.customerId,
      customerName: (customer as { name: string }).name,
      invoiceNumber,
      invoiceDate: params.invoiceDate,
      dueDate: params.dueDate,
      description: params.description,
      amountHt: totals.amountHt,
      amountTtc: totals.amountTtc,
      lines,
    });
    revalidatePath("/admin/company/emitted");
    return { ok: true, data: { id: invoice.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function emitPlatformEmittedInvoiceAction(
  emittedInvoiceId: string
): Promise<ActionResult<{ paInvoiceId: number; lifecycleStatus: string | null }>> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;

  const result = await emitPlatformPaInvoice(emittedInvoiceId);
  revalidatePath("/admin/company/emitted");
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    data: { paInvoiceId: result.paInvoiceId, lifecycleStatus: result.lifecycleStatus },
  };
}

export async function suggestEmittedInvoiceNumberAction(): Promise<ActionResult<{ number: string }>> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;
  return { ok: true, data: { number: suggestInvoiceNumber() } };
}
