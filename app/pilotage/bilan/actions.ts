"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isExpenseCategory } from "@/lib/pocket/expenseCategories";

export type PocketActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Le bilan « Ma poche » expose les finances de l'établissement : accès strictement
 * réservé au PROPRIÉTAIRE (pas aux collaborateurs, même managers).
 */
async function gateOwner(restaurantId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const { data } = await supabaseServer
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!data || (data as { owner_id: string }).owner_id !== user.id) {
    return { ok: false, error: "Réservé au propriétaire de l'établissement." };
  }
  return { ok: true };
}

export async function setStaffHourlyRateAction(params: {
  restaurantId: string;
  staffMemberId: string;
  hourlyGrossRate: number | null;
}): Promise<PocketActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const rate = params.hourlyGrossRate;
  if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 500)) {
    return { ok: false, error: "Taux horaire brut invalide (0 à 500 €)." };
  }

  const { error } = await supabaseServer
    .from("staff_members")
    .update({ hourly_gross_rate: rate })
    .eq("id", params.staffMemberId)
    .eq("restaurant_id", params.restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/pilotage/bilan");
  revalidatePath("/pilotage/rh/paie");
  return { ok: true };
}

export async function setStaffPasRateAction(params: {
  restaurantId: string;
  staffMemberId: string;
  withholdingTaxRatePct: number | null;
}): Promise<PocketActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const rate = params.withholdingTaxRatePct;
  if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
    return { ok: false, error: "Taux PAS invalide (0 à 100 %)." };
  }

  const { error } = await supabaseServer
    .from("staff_members")
    .update({ withholding_tax_rate_pct: rate })
    .eq("id", params.staffMemberId)
    .eq("restaurant_id", params.restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/pilotage/bilan");
  revalidatePath("/pilotage/rh/paie");
  return { ok: true };
}

export async function saveFixedChargeAction(params: {
  restaurantId: string;
  id?: string;
  label: string;
  monthlyAmount: number;
  category: string;
  periodicity: string;
}): Promise<PocketActionResult<{ id: string }>> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const label = params.label.trim();
  if (!label) return { ok: false, error: "Le libellé est requis." };
  if (label.length > 120) return { ok: false, error: "Libellé trop long (max. 120 caractères)." };
  const amount = params.monthlyAmount;
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return { ok: false, error: "Montant invalide." };
  }
  if (!isExpenseCategory(params.category)) {
    return { ok: false, error: "Poste comptable invalide." };
  }
  const periodicity = params.periodicity;
  if (periodicity !== "monthly" && periodicity !== "quarterly" && periodicity !== "yearly") {
    return { ok: false, error: "Périodicité invalide." };
  }

  const fields = {
    label,
    monthly_amount: amount,
    category: params.category,
    periodicity,
  };

  if (params.id) {
    const { error } = await supabaseServer
      .from("restaurant_fixed_charges")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("restaurant_id", params.restaurantId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/pilotage/bilan");
    revalidatePath("/pilotage/rh/administratif");
    return { ok: true, data: { id: params.id } };
  }

  const { data, error } = await supabaseServer
    .from("restaurant_fixed_charges")
    .insert({ restaurant_id: params.restaurantId, ...fields })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insertion impossible." };
  revalidatePath("/pilotage/bilan");
  revalidatePath("/pilotage/rh/administratif");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

/**
 * Corrige le poste comptable d'une facture (classement IA imparfait).
 */
export async function setInvoiceExpenseCategoryAction(params: {
  restaurantId: string;
  invoiceId: string;
  category: string;
}): Promise<PocketActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  if (!isExpenseCategory(params.category)) {
    return { ok: false, error: "Poste comptable invalide." };
  }

  const { error } = await supabaseServer
    .from("supplier_invoices")
    .update({ expense_category: params.category, updated_at: new Date().toISOString() })
    .eq("id", params.invoiceId)
    .eq("restaurant_id", params.restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pilotage/bilan");
  revalidatePath("/pilotage/rh/administratif");
  return { ok: true };
}

export async function deleteFixedChargeAction(params: {
  restaurantId: string;
  chargeId: string;
}): Promise<PocketActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const { error } = await supabaseServer
    .from("restaurant_fixed_charges")
    .delete()
    .eq("id", params.chargeId)
    .eq("restaurant_id", params.restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pilotage/bilan");
  revalidatePath("/pilotage/rh/administratif");
  return { ok: true };
}

export async function savePocketSettingsAction(params: {
  restaurantId: string;
  payrollEmployerPct: number;
  pocketTaxPct: number | null;
  payrollAtmpRatePct?: number | null;
}): Promise<PocketActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const employer = params.payrollEmployerPct;
  if (!Number.isFinite(employer) || employer < 0 || employer > 100) {
    return { ok: false, error: "Charges patronales : pourcentage entre 0 et 100." };
  }
  const tax = params.pocketTaxPct;
  if (tax != null && (!Number.isFinite(tax) || tax < 0 || tax > 100)) {
    return { ok: false, error: "Estimation impôts : pourcentage entre 0 et 100 (ou vide)." };
  }
  const atmp = params.payrollAtmpRatePct;
  if (atmp != null && (!Number.isFinite(atmp) || atmp < 0 || atmp > 20)) {
    return { ok: false, error: "Taux AT/MP : entre 0 et 20 %." };
  }

  const { error } = await supabaseServer
    .from("restaurants")
    .update({
      payroll_employer_pct: employer,
      pocket_tax_pct: tax,
      ...(atmp !== undefined ? { payroll_atmp_rate: atmp } : {}),
    })
    .eq("id", params.restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pilotage/bilan");
  revalidatePath("/pilotage/rh/paie");
  return { ok: true };
}
