import { supabaseServer } from "@/lib/supabaseServer";
import type { HcrContractDraft, HcrContractKind } from "./types";

export type HcrContractStatus = "draft" | "exported";

export type HcrContractRow = {
  id: string;
  restaurantId: string;
  staffMemberId: string | null;
  contractKind: HcrContractKind;
  employeeFirstName: string;
  employeeLastName: string;
  title: string;
  draft: HcrContractDraft;
  status: HcrContractStatus;
  createdAt: string;
  updatedAt: string;
};

export function contractTitleFromDraft(draft: HcrContractDraft): string {
  const name = `${draft.employee.firstName} ${draft.employee.lastName}`.trim();
  return `${draft.contractKind.toUpperCase()}${name ? ` - ${name}` : ""}`.trim();
}

function mapRow(row: Record<string, unknown>): HcrContractRow {
  return {
    id: String(row.id),
    restaurantId: String(row.restaurant_id),
    staffMemberId: row.staff_member_id ? String(row.staff_member_id) : null,
    contractKind: String(row.contract_kind) as HcrContractKind,
    employeeFirstName: String(row.employee_first_name),
    employeeLastName: String(row.employee_last_name),
    title: String(row.title),
    draft: row.draft_json as HcrContractDraft,
    status: String(row.status) as HcrContractStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listHcrContracts(restaurantId: string): Promise<HcrContractRow[]> {
  const { data, error } = await supabaseServer
    .from("hcr_contracts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function getHcrContractById(
  restaurantId: string,
  contractId: string
): Promise<HcrContractRow | null> {
  const { data, error } = await supabaseServer
    .from("hcr_contracts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", contractId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function insertHcrContract(params: {
  restaurantId: string;
  draft: HcrContractDraft;
  status?: HcrContractStatus;
}): Promise<HcrContractRow> {
  const title = contractTitleFromDraft(params.draft);
  const { data, error } = await supabaseServer
    .from("hcr_contracts")
    .insert({
      restaurant_id: params.restaurantId,
      staff_member_id: params.draft.employee.staffMemberId ?? null,
      contract_kind: params.draft.contractKind,
      employee_first_name: params.draft.employee.firstName.trim() || "—",
      employee_last_name: params.draft.employee.lastName.trim() || "—",
      title,
      draft_json: params.draft,
      status: params.status ?? "draft",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function updateHcrContract(params: {
  restaurantId: string;
  contractId: string;
  draft: HcrContractDraft;
  status?: HcrContractStatus;
}): Promise<HcrContractRow> {
  const title = contractTitleFromDraft(params.draft);
  const fields: Record<string, unknown> = {
    staff_member_id: params.draft.employee.staffMemberId ?? null,
    contract_kind: params.draft.contractKind,
    employee_first_name: params.draft.employee.firstName.trim() || "—",
    employee_last_name: params.draft.employee.lastName.trim() || "—",
    title,
    draft_json: params.draft,
  };
  if (params.status) fields.status = params.status;

  const { data, error } = await supabaseServer
    .from("hcr_contracts")
    .update(fields)
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.contractId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteHcrContract(restaurantId: string, contractId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("hcr_contracts")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", contractId);

  if (error) throw new Error(error.message);
}
