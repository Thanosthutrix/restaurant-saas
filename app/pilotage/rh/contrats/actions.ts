"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  deleteHcrContract,
  insertHcrContract,
  updateHcrContract,
  type HcrContractStatus,
} from "@/lib/hcr-contracts/hcrContractsDb";
import type { HcrContractDraft } from "@/lib/hcr-contracts/types";
import { validateContractDraft } from "@/lib/hcr-contracts/validateContractDraft";

export type HcrContractActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const CONTRACTS_PATH = "/pilotage/rh/contrats";

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

function revalidateContracts() {
  revalidatePath(CONTRACTS_PATH);
  revalidatePath("/pilotage/rh");
}

export async function saveHcrContractAction(params: {
  restaurantId: string;
  draft: HcrContractDraft;
  contractId?: string;
  status?: HcrContractStatus;
}): Promise<HcrContractActionResult<{ id: string }>> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const blocking = validateContractDraft(params.draft).filter((i) => i.severity === "blocking");
  if (blocking.length > 0) {
    return { ok: false, error: blocking[0]!.message };
  }

  try {
    if (params.contractId) {
      const row = await updateHcrContract({
        restaurantId: params.restaurantId,
        contractId: params.contractId,
        draft: params.draft,
        status: params.status,
      });
      revalidateContracts();
      revalidatePath(`${CONTRACTS_PATH}/${row.id}`);
      return { ok: true, data: { id: row.id } };
    }

    const row = await insertHcrContract({
      restaurantId: params.restaurantId,
      draft: params.draft,
      status: params.status,
    });
    revalidateContracts();
    revalidatePath(`${CONTRACTS_PATH}/${row.id}`);
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Enregistrement impossible." };
  }
}

export async function deleteHcrContractAction(params: {
  restaurantId: string;
  contractId: string;
}): Promise<HcrContractActionResult> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  try {
    await deleteHcrContract(params.restaurantId, params.contractId);
    revalidateContracts();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Suppression impossible." };
  }
}
