"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin";
import {
  createPlatformCompany,
  createPlatformSupplier,
  getPlatformCompany,
  updatePlatformCompany,
  type PlatformCompanyInput,
} from "@/lib/platform/companyDb";

export type CompanyActionResult = { ok: true } | { ok: false; error: string };

async function gateAdmin(): Promise<CompanyActionResult | { ok: true; admin: true }> {
  if (!(await isCurrentUserAdmin())) {
    return { ok: false, error: "Accès refusé." };
  }
  return { ok: true, admin: true };
}

export async function savePlatformCompanyAction(
  input: PlatformCompanyInput
): Promise<CompanyActionResult> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;

  const legalName = input.legalName?.trim();
  if (!legalName) return { ok: false, error: "Raison sociale obligatoire." };

  try {
    const existing = await getPlatformCompany();
    if (existing) {
      await updatePlatformCompany(existing.id, input);
    } else {
      await createPlatformCompany(input);
    }
    revalidatePath("/admin/company");
    revalidatePath("/legal/terms");
    revalidatePath("/legal/privacy");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur enregistrement." };
  }
}

export async function createPlatformSupplierAction(params: {
  name: string;
  email?: string | null;
  siret?: string | null;
}): Promise<CompanyActionResult & { supplierId?: string }> {
  const auth = await gateAdmin();
  if (!auth.ok) return auth;

  const company = await getPlatformCompany();
  if (!company) {
    return { ok: false, error: "Créez d'abord le profil de votre société." };
  }

  const name = params.name.trim();
  if (!name) return { ok: false, error: "Nom du fournisseur obligatoire." };

  try {
    const supplier = await createPlatformSupplier({
      companyId: company.id,
      name,
      email: params.email,
      siret: params.siret,
    });
    revalidatePath("/admin/company");
    revalidatePath("/admin/company/invoices");
    return { ok: true, supplierId: supplier.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur fournisseur." };
  }
}
