import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import {
  isPlatformExpenseCategory,
  PLATFORM_EXPENSE_CATEGORY_VALUES,
  type PlatformExpenseCategory,
} from "@/lib/platform/platformExpenseCategories";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysInclusive(from: string, to: string): number {
  const a = new Date(from + "T12:00:00Z").getTime();
  const b = new Date(to + "T12:00:00Z").getTime();
  return Math.max(1, Math.floor((b - a) / 86400000) + 1);
}

function monthlyEquivalent(charge: PlatformFixedChargeRow): number {
  if (charge.periodicity === "quarterly") return charge.monthlyAmount / 3;
  if (charge.periodicity === "yearly") return charge.monthlyAmount / 12;
  return charge.monthlyAmount;
}

export type PlatformFixedChargeRow = {
  id: string;
  label: string;
  monthlyAmount: number;
  active: boolean;
  category: PlatformExpenseCategory;
  periodicity: "monthly" | "quarterly" | "yearly";
};

export type PlatformInvoiceRow = {
  id: string;
  label: string;
  invoiceDate: string | null;
  amountHt: number;
  approxTtc: boolean;
  category: PlatformExpenseCategory;
};

export type PlatformStaffLine = {
  staffMemberId: string;
  displayName: string;
  hours: number;
  hourlyGrossRate: number | null;
  loadedCost: number | null;
};

export type PlatformPosteBreakdown = {
  category: PlatformExpenseCategory;
  invoicesHt: number;
  invoicesCount: number;
  manualPortion: number;
  labor: number;
  total: number;
};

export type PlatformPocketReport = {
  from: string;
  to: string;
  days: number;
  revenueHt: number;
  revenueFromEmitted: number;
  laborCost: number;
  laborLines: PlatformStaffLine[];
  staffMissingRate: string[];
  payrollEmployerPct: number;
  postes: PlatformPosteBreakdown[];
  invoicesByCategory: Record<string, PlatformInvoiceRow[]>;
  invoicesWithoutAmount: number;
  totalExpenses: number;
  operatingResult: number;
  pocketTaxPct: number | null;
  taxEstimate: number;
  pocket: number;
  fixedCharges: PlatformFixedChargeRow[];
};

export async function listPlatformFixedCharges(companyId: string): Promise<PlatformFixedChargeRow[]> {
  const { data } = await supabaseServer
    .from("platform_fixed_charges")
    .select("id, label, monthly_amount, active, category, periodicity")
    .eq("company_id", companyId)
    .order("sort_order")
    .order("label");

  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
    id: String(r.id),
    label: String(r.label),
    monthlyAmount: Number(r.monthly_amount) || 0,
    active: Boolean(r.active),
    category: isPlatformExpenseCategory(String(r.category ?? ""))
      ? (r.category as PlatformExpenseCategory)
      : "divers",
    periodicity:
      r.periodicity === "quarterly" || r.periodicity === "yearly"
        ? (r.periodicity as "quarterly" | "yearly")
        : "monthly",
  }));
}

async function loadPocketSettings(companyId: string) {
  const { data } = await supabaseServer
    .from("platform_companies")
    .select("payroll_employer_pct, pocket_tax_pct")
    .eq("id", companyId)
    .maybeSingle();

  const row = data as { payroll_employer_pct?: unknown; pocket_tax_pct?: unknown } | null;
  const employer = row?.payroll_employer_pct != null ? Number(row.payroll_employer_pct) : 42;
  const tax = row?.pocket_tax_pct != null ? Number(row.pocket_tax_pct) : null;

  return {
    payrollEmployerPct: Number.isFinite(employer) ? employer : 42,
    pocketTaxPct: tax != null && Number.isFinite(tax) ? tax : null,
  };
}

async function loadInvoices(companyId: string, from: string, to: string) {
  const { data } = await supabaseServer
    .from("platform_invoices")
    .select("id, invoice_number, file_name, invoice_date, amount_ht, amount_ttc, expense_category")
    .eq("company_id", companyId)
    .gte("invoice_date", from)
    .lte("invoice_date", to)
    .limit(3000);

  const byCategory: Record<string, PlatformInvoiceRow[]> = {};
  let withoutAmount = 0;

  for (const r of (data as Record<string, unknown>[]) ?? []) {
    const ht = r.amount_ht != null ? Number(r.amount_ht) : null;
    const ttc = r.amount_ttc != null ? Number(r.amount_ttc) : null;
    const amount = ht != null && Number.isFinite(ht) ? ht : ttc != null && Number.isFinite(ttc) ? ttc : null;
    if (amount == null) {
      withoutAmount += 1;
      continue;
    }
    const category = isPlatformExpenseCategory(String(r.expense_category ?? ""))
      ? (r.expense_category as PlatformExpenseCategory)
      : "divers";
    const row: PlatformInvoiceRow = {
      id: String(r.id),
      label: String(r.invoice_number || r.file_name || "Facture"),
      invoiceDate: r.invoice_date ? String(r.invoice_date) : null,
      amountHt: round2(amount),
      approxTtc: ht == null,
      category,
    };
    (byCategory[category] ??= []).push(row);
  }

  for (const list of Object.values(byCategory)) {
    list.sort((a, b) => (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? "") || b.amountHt - a.amountHt);
  }
  return { byCategory, withoutAmount };
}

async function loadEmittedRevenue(companyId: string, from: string, to: string): Promise<number> {
  const { data } = await supabaseServer
    .from("platform_emitted_invoices")
    .select("amount_ht, invoice_date, status")
    .eq("company_id", companyId)
    .in("status", ["sent", "paid"])
    .gte("invoice_date", from)
    .lte("invoice_date", to);

  let total = 0;
  for (const r of (data as { amount_ht: unknown }[]) ?? []) {
    const ht = r.amount_ht != null ? Number(r.amount_ht) : 0;
    if (Number.isFinite(ht)) total += ht;
  }
  return round2(total);
}

async function computeLabor(companyId: string, from: string, to: string, payrollEmployerPct: number) {
  const fromIso = from + "T00:00:00.000Z";
  const toIso = to + "T23:59:59.999Z";

  const [{ data: staffRows }, { data: shiftRows }] = await Promise.all([
    supabaseServer
      .from("platform_staff_members")
      .select("id, display_name, hourly_gross_rate")
      .eq("company_id", companyId)
      .eq("active", true),
    supabaseServer
      .from("platform_work_shifts")
      .select("staff_member_id, starts_at, ends_at")
      .eq("company_id", companyId)
      .gte("starts_at", fromIso)
      .lte("starts_at", toIso),
  ]);

  const staffMap = new Map<string, { displayName: string; rate: number | null }>();
  for (const s of (staffRows as Record<string, unknown>[]) ?? []) {
    staffMap.set(String(s.id), {
      displayName: String(s.display_name),
      rate: s.hourly_gross_rate != null ? Number(s.hourly_gross_rate) : null,
    });
  }

  const hoursByStaff = new Map<string, number>();
  for (const sh of (shiftRows as Record<string, unknown>[]) ?? []) {
    const start = Date.parse(String(sh.starts_at));
    const end = Date.parse(String(sh.ends_at));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const staffId = String(sh.staff_member_id);
    hoursByStaff.set(staffId, (hoursByStaff.get(staffId) ?? 0) + (end - start) / 3600000);
  }

  const lines: PlatformStaffLine[] = [];
  const missing: string[] = [];
  let total = 0;
  const multiplier = 1 + payrollEmployerPct / 100;

  for (const [staffId, hours] of hoursByStaff) {
    const staff = staffMap.get(staffId);
    if (!staff) continue;
    const loaded =
      staff.rate != null && Number.isFinite(staff.rate)
        ? round2(hours * staff.rate * multiplier)
        : null;
    if (loaded == null) missing.push(staff.displayName);
    else total += loaded;
    lines.push({
      staffMemberId: staffId,
      displayName: staff.displayName,
      hours: round2(hours),
      hourlyGrossRate: staff.rate,
      loadedCost: loaded,
    });
  }

  lines.sort((a, b) => (b.loadedCost ?? 0) - (a.loadedCost ?? 0) || b.hours - a.hours);
  return { lines, total: round2(total), missing };
}

function allocateManualCharges(
  charges: PlatformFixedChargeRow[],
  from: string,
  to: string
): { byCategory: Map<PlatformExpenseCategory, number>; openDaysInPeriod: number } {
  const days = daysInclusive(from, to);
  const byCategory = new Map<PlatformExpenseCategory, number>();

  for (const charge of charges) {
    if (!charge.active) continue;
    const monthly = monthlyEquivalent(charge);
    const portion = round2((monthly / 30) * days);
    byCategory.set(charge.category, round2((byCategory.get(charge.category) ?? 0) + portion));
  }

  return { byCategory, openDaysInPeriod: days };
}

export async function buildPlatformPocketReport(
  companyId: string,
  from: string,
  to: string
): Promise<PlatformPocketReport> {
  const settings = await loadPocketSettings(companyId);

  const [charges, invoices, revenueFromEmitted, labor] = await Promise.all([
    listPlatformFixedCharges(companyId),
    loadInvoices(companyId, from, to),
    loadEmittedRevenue(companyId, from, to),
    computeLabor(companyId, from, to, settings.payrollEmployerPct),
  ]);

  const allocation = allocateManualCharges(
    charges.filter((c) => c.active),
    from,
    to
  );

  const postes: PlatformPosteBreakdown[] = [];
  let totalExpenses = 0;

  for (const category of PLATFORM_EXPENSE_CATEGORY_VALUES) {
    const invoiceRows = invoices.byCategory[category] ?? [];
    const invoicesHt = round2(invoiceRows.reduce((s, r) => s + r.amountHt, 0));
    const manualPortion = round2(allocation.byCategory.get(category) ?? 0);
    const laborPart = category === "rh_personnel" ? labor.total : 0;
    const total = round2(invoicesHt + manualPortion + laborPart);
    if (total === 0 && invoiceRows.length === 0) continue;
    totalExpenses += total;
    postes.push({
      category,
      invoicesHt,
      invoicesCount: invoiceRows.length,
      manualPortion,
      labor: laborPart,
      total,
    });
  }

  totalExpenses = round2(totalExpenses);
  const revenueHt = revenueFromEmitted;
  const operatingResult = round2(revenueHt - totalExpenses);
  const taxEstimate =
    settings.pocketTaxPct != null && operatingResult > 0
      ? round2((operatingResult * settings.pocketTaxPct) / 100)
      : 0;
  const pocket = round2(operatingResult - taxEstimate);

  return {
    from,
    to,
    days: daysInclusive(from, to),
    revenueHt,
    revenueFromEmitted,
    laborCost: labor.total,
    laborLines: labor.lines,
    staffMissingRate: labor.missing,
    payrollEmployerPct: settings.payrollEmployerPct,
    postes,
    invoicesByCategory: invoices.byCategory,
    invoicesWithoutAmount: invoices.withoutAmount,
    totalExpenses,
    operatingResult,
    pocketTaxPct: settings.pocketTaxPct,
    taxEstimate,
    pocket,
    fixedCharges: charges,
  };
}
