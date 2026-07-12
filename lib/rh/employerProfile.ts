import { supabaseServer } from "@/lib/supabaseServer";
import { DEFAULT_CONVENTION_IDCC } from "@/lib/hcr-contracts/conventionRegistry";
import type { HcrEmployerIdentity } from "@/lib/hcr-contracts/types";

export type EmployerProfile = {
  restaurantId: string;
  companyName: string;
  legalName: string;
  legalForm: string;
  siret: string;
  urssafOffice: string;
  address: string;
  representativeName: string;
  representativeRole: string;
  collectiveAgreementIdcc: string;
  retirementFund: string;
  healthProvider: string;
  medecineTravailOrganisme: string;
};

export type EmployerProfileInput = Omit<EmployerProfile, "restaurantId" | "companyName" | "address"> & {
  address?: string;
};

const PROFILE_COLUMNS =
  "id, name, address_text, legal_name, legal_form, siret, urssaf_office, representative_name, representative_role, collective_agreement_idcc, retirement_fund, health_provider, medecine_travail_organisme";

function mapProfile(row: Record<string, unknown>): EmployerProfile {
  return {
    restaurantId: String(row.id),
    companyName: String(row.name ?? ""),
    legalName: String(row.legal_name ?? row.name ?? ""),
    legalForm: String(row.legal_form ?? ""),
    siret: String(row.siret ?? ""),
    urssafOffice: String(row.urssaf_office ?? ""),
    address: String(row.address_text ?? ""),
    representativeName: String(row.representative_name ?? ""),
    representativeRole: String(row.representative_role ?? "Gérant"),
    collectiveAgreementIdcc: String(row.collective_agreement_idcc ?? DEFAULT_CONVENTION_IDCC),
    retirementFund: String(row.retirement_fund ?? ""),
    healthProvider: String(row.health_provider ?? ""),
    medecineTravailOrganisme: String(row.medecine_travail_organisme ?? ""),
  };
}

export async function getEmployerProfile(restaurantId: string): Promise<EmployerProfile | null> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select(PROFILE_COLUMNS)
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapProfile(data as Record<string, unknown>);
}

export function employerProfileToHcrIdentity(profile: EmployerProfile): HcrEmployerIdentity {
  return {
    restaurantId: profile.restaurantId,
    companyName: profile.companyName,
    legalName: profile.legalName || profile.companyName,
    legalForm: profile.legalForm,
    siret: profile.siret,
    urssafOffice: profile.urssafOffice,
    address: profile.address,
    representativeName: profile.representativeName,
    representativeRole: profile.representativeRole || "Gérant",
    collectiveAgreementIdcc: profile.collectiveAgreementIdcc || DEFAULT_CONVENTION_IDCC,
    retirementFund: profile.retirementFund,
    healthProvider: profile.healthProvider,
  };
}

export async function updateEmployerProfile(
  restaurantId: string,
  input: EmployerProfileInput & { address: string }
): Promise<EmployerProfile> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .update({
      legal_name: input.legalName.trim() || null,
      legal_form: input.legalForm.trim() || null,
      siret: input.siret.trim() || null,
      urssaf_office: input.urssafOffice.trim() || null,
      address_text: input.address.trim() || null,
      representative_name: input.representativeName.trim() || null,
      representative_role: input.representativeRole.trim() || "Gérant",
      collective_agreement_idcc: input.collectiveAgreementIdcc.trim() || DEFAULT_CONVENTION_IDCC,
      retirement_fund: input.retirementFund.trim() || null,
      health_provider: input.healthProvider.trim() || null,
      medecine_travail_organisme: input.medecineTravailOrganisme.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", restaurantId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapProfile(data as Record<string, unknown>);
}
