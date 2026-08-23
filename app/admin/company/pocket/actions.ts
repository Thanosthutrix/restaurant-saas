"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import { isPlatformExpenseCategory } from "@/lib/platform/platformExpenseCategories";
import { supabaseServer } from "@/lib/supabaseServer";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function gateAdminCompany(): Promise<ActionResult<{ companyId: string }>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès refusé." };
  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Configurez d'abord le profil de votre société." };
  return { ok: true, data: { companyId: company.id } };
}

export async function savePlatformFixedChargeAction(params: {
  id?: string;
  label: string;
  monthlyAmount: number;
  category: string;
  periodicity: string;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  const label = params.label.trim();
  if (!label) return { ok: false, error: "Le libellé est requis." };
  if (!Number.isFinite(params.monthlyAmount) || params.monthlyAmount < 0) {
    return { ok: false, error: "Montant invalide." };
  }
  if (!isPlatformExpenseCategory(params.category)) {
    return { ok: false, error: "Poste comptable invalide." };
  }
  if (!["monthly", "quarterly", "yearly"].includes(params.periodicity)) {
    return { ok: false, error: "Périodicité invalide." };
  }

  const fields = {
    label,
    monthly_amount: params.monthlyAmount,
    category: params.category,
    periodicity: params.periodicity,
    updated_at: new Date().toISOString(),
  };

  if (params.id) {
    const { error } = await supabaseServer
      .from("platform_fixed_charges")
      .update(fields)
      .eq("id", params.id)
      .eq("company_id", auth.data!.companyId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/company/pocket");
    return { ok: true, data: { id: params.id } };
  }

  const { data, error } = await supabaseServer
    .from("platform_fixed_charges")
    .insert({ company_id: auth.data!.companyId, ...fields })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insertion impossible." };
  revalidatePath("/admin/company/pocket");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function deletePlatformFixedChargeAction(chargeId: string): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  const { error } = await supabaseServer
    .from("platform_fixed_charges")
    .delete()
    .eq("id", chargeId)
    .eq("company_id", auth.data!.companyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/company/pocket");
  return { ok: true };
}

export async function savePlatformPocketSettingsAction(params: {
  payrollEmployerPct: number;
  pocketTaxPct: number | null;
}): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  if (!Number.isFinite(params.payrollEmployerPct) || params.payrollEmployerPct < 0 || params.payrollEmployerPct > 100) {
    return { ok: false, error: "Charges patronales invalides." };
  }
  if (
    params.pocketTaxPct != null &&
    (!Number.isFinite(params.pocketTaxPct) || params.pocketTaxPct < 0 || params.pocketTaxPct > 100)
  ) {
    return { ok: false, error: "Estimation impôts invalide." };
  }

  const { error } = await supabaseServer
    .from("platform_companies")
    .update({
      payroll_employer_pct: params.payrollEmployerPct,
      pocket_tax_pct: params.pocketTaxPct,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.data!.companyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/company/pocket");
  return { ok: true };
}

export async function setPlatformStaffHourlyRateAction(params: {
  staffMemberId: string;
  hourlyGrossRate: number | null;
}): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  const rate = params.hourlyGrossRate;
  if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 500)) {
    return { ok: false, error: "Taux horaire invalide." };
  }

  const { error } = await supabaseServer
    .from("platform_staff_members")
    .update({ hourly_gross_rate: rate, updated_at: new Date().toISOString() })
    .eq("id", params.staffMemberId)
    .eq("company_id", auth.data!.companyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/company/pocket");
  revalidatePath("/admin/company/team");
  return { ok: true };
}

export async function setPlatformInvoiceExpenseCategoryAction(params: {
  invoiceId: string;
  category: string;
}): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;
  if (!isPlatformExpenseCategory(params.category)) {
    return { ok: false, error: "Poste comptable invalide." };
  }

  const { error } = await supabaseServer
    .from("platform_invoices")
    .update({ expense_category: params.category, updated_at: new Date().toISOString() })
    .eq("id", params.invoiceId)
    .eq("company_id", auth.data!.companyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/company/pocket");
  revalidatePath("/admin/company/invoices");
  return { ok: true };
}
