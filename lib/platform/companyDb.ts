import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

export type PlatformCompany = {
  id: string;
  legal_name: string;
  legal_form: string | null;
  siren: string | null;
  siret: string | null;
  rcs_ville: string | null;
  capital: string | null;
  address: string | null;
  representative_name: string | null;
  representative_role: string | null;
  contact_email: string | null;
  ape_code: string | null;
  vat_number: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformCompanyInput = {
  legalName: string;
  legalForm?: string | null;
  siren?: string | null;
  siret?: string | null;
  rcsVille?: string | null;
  capital?: string | null;
  address?: string | null;
  representativeName?: string | null;
  representativeRole?: string | null;
  contactEmail?: string | null;
  apeCode?: string | null;
  vatNumber?: string | null;
};

export type PlatformSupplier = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  siret: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const COMPANY_SELECT =
  "id, legal_name, legal_form, siren, siret, rcs_ville, capital, address, representative_name, representative_role, contact_email, ape_code, vat_number, created_at, updated_at";

export async function getPlatformCompany(): Promise<PlatformCompany | null> {
  const { data, error } = await supabaseServer
    .from("platform_companies")
    .select(COMPANY_SELECT)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as PlatformCompany | null) ?? null;
}

export async function createPlatformCompany(input: PlatformCompanyInput): Promise<PlatformCompany> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("platform_companies")
    .insert({
      legal_name: input.legalName.trim(),
      legal_form: input.legalForm?.trim() || null,
      siren: input.siren?.trim() || null,
      siret: input.siret?.trim() || null,
      rcs_ville: input.rcsVille?.trim() || null,
      capital: input.capital?.trim() || null,
      address: input.address?.trim() || null,
      representative_name: input.representativeName?.trim() || null,
      representative_role: input.representativeRole?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      ape_code: input.apeCode?.trim() || null,
      vat_number: input.vatNumber?.trim() || null,
      updated_at: now,
    })
    .select(COMPANY_SELECT)
    .single();

  if (error || !data) throw error ?? new Error("Création société impossible.");
  return data as PlatformCompany;
}

export async function updatePlatformCompany(
  companyId: string,
  input: PlatformCompanyInput
): Promise<PlatformCompany> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("platform_companies")
    .update({
      legal_name: input.legalName.trim(),
      legal_form: input.legalForm?.trim() || null,
      siren: input.siren?.trim() || null,
      siret: input.siret?.trim() || null,
      rcs_ville: input.rcsVille?.trim() || null,
      capital: input.capital?.trim() || null,
      address: input.address?.trim() || null,
      representative_name: input.representativeName?.trim() || null,
      representative_role: input.representativeRole?.trim() || null,
      contact_email: input.contactEmail?.trim() || null,
      ape_code: input.apeCode?.trim() || null,
      vat_number: input.vatNumber?.trim() || null,
      updated_at: now,
    })
    .eq("id", companyId)
    .select(COMPANY_SELECT)
    .single();

  if (error || !data) throw error ?? new Error("Mise à jour société impossible.");
  return data as PlatformCompany;
}

export async function listPlatformSuppliers(companyId: string): Promise<PlatformSupplier[]> {
  const { data, error } = await supabaseServer
    .from("platform_suppliers")
    .select("id, company_id, name, email, siret, notes, created_at, updated_at")
    .eq("company_id", companyId)
    .order("name");

  if (error) throw error;
  return (data ?? []) as PlatformSupplier[];
}

export async function createPlatformSupplier(params: {
  companyId: string;
  name: string;
  email?: string | null;
  siret?: string | null;
  notes?: string | null;
}): Promise<PlatformSupplier> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("platform_suppliers")
    .insert({
      company_id: params.companyId,
      name: params.name.trim(),
      email: params.email?.trim() || null,
      siret: params.siret?.trim() || null,
      notes: params.notes?.trim() || null,
      updated_at: now,
    })
    .select("id, company_id, name, email, siret, notes, created_at, updated_at")
    .single();

  if (error || !data) throw error ?? new Error("Création fournisseur impossible.");
  return data as PlatformSupplier;
}

export async function requirePlatformCompany(): Promise<PlatformCompany> {
  const company = await getPlatformCompany();
  if (!company) {
    throw new Error("Configurez d'abord le profil de votre société.");
  }
  return company;
}

export async function resolveOrCreatePlatformSupplier(
  companyId: string,
  vendor: {
    legal_name?: string | null;
    email?: string | null;
    siret?: string | null;
  },
  fallbackLabel: string
): Promise<PlatformSupplier> {
  const name = vendor.legal_name?.trim() || fallbackLabel;
  const suppliers = await listPlatformSuppliers(companyId);
  const bySiret = vendor.siret
    ? suppliers.find((s) => s.siret && s.siret === vendor.siret)
    : undefined;
  if (bySiret) return bySiret;
  const byName = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (byName) return byName;
  return createPlatformSupplier({ companyId, name, email: vendor.email, siret: vendor.siret });
}
