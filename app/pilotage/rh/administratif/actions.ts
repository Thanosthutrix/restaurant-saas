"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isExpenseCategory } from "@/lib/pocket/expenseCategories";
import { updateEmployerProfile, type EmployerProfileInput } from "@/lib/rh/employerProfile";
import { deleteRestaurantInvestment, insertRestaurantInvestment } from "@/lib/rh/investmentsDb";

export type AdministratifActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const ADMIN_PATH = "/pilotage/rh/administratif";

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

function revalidateAdministratif() {
  revalidatePath(ADMIN_PATH);
  revalidatePath("/pilotage/rh/contrats");
  revalidatePath("/pilotage/rh/contrats/nouveau");
}

export async function saveEmployerProfileAction(params: {
  restaurantId: string;
  profile: EmployerProfileInput & { address: string };
}): Promise<AdministratifActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const siret = params.profile.siret.trim().replace(/\s/g, "");
  if (siret && !/^\d{14}$/.test(siret)) {
    return { ok: false, error: "SIRET invalide (14 chiffres attendus)." };
  }

  try {
    await updateEmployerProfile(params.restaurantId, {
      ...params.profile,
      siret,
    });
    revalidateAdministratif();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

export async function saveInvestmentAction(params: {
  restaurantId: string;
  label: string;
  expenseCategory: string;
  acquisitionDate?: string | null;
  amountTotal: number;
  amortizationYears?: number | null;
  supplierInvoiceId?: string | null;
  notes?: string | null;
}): Promise<AdministratifActionResult<{ id: string }>> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const label = params.label.trim();
  if (!label) return { ok: false, error: "Libellé requis." };
  if (!isExpenseCategory(params.expenseCategory)) {
    return { ok: false, error: "Secteur invalide." };
  }
  if (!Number.isFinite(params.amountTotal) || params.amountTotal < 0) {
    return { ok: false, error: "Montant invalide." };
  }
  const years = params.amortizationYears;
  if (years != null && (!Number.isFinite(years) || years <= 0 || years > 50)) {
    return { ok: false, error: "Durée d'amortissement invalide (1 à 50 ans)." };
  }

  try {
    const row = await insertRestaurantInvestment({
      restaurantId: params.restaurantId,
      label,
      expenseCategory: params.expenseCategory,
      acquisitionDate: params.acquisitionDate,
      amountTotal: params.amountTotal,
      amortizationYears: years,
      supplierInvoiceId: params.supplierInvoiceId,
      notes: params.notes,
    });
    revalidateAdministratif();
    revalidatePath("/pilotage/bilan");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

export async function deleteInvestmentAction(params: {
  restaurantId: string;
  investmentId: string;
}): Promise<AdministratifActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  try {
    await deleteRestaurantInvestment(params.restaurantId, params.investmentId);
    revalidateAdministratif();
    revalidatePath("/pilotage/bilan");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Suppression impossible." };
  }
}
