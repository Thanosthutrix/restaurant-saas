"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { listHcrContracts } from "@/lib/hcr-contracts/hcrContractsDb";
import { getEmployerProfile } from "@/lib/rh/employerProfile";
import { buildSignalementDsn } from "@/lib/rh/dsn/buildSignalementDsn";
import type { DsnSignalementKind } from "@/lib/rh/dsn/dsnSignalementTypes";
import {
  ARRET_MOTIF_OPTIONS,
  FIN_CONTRAT_MOTIF_OPTIONS,
  REPRISE_MOTIF_OPTIONS,
} from "@/lib/rh/dsn/dsnSignalementMotifs";
import {
  getDsnSignalement,
  insertDsnSignalement,
  insertDsnSignalementExport,
  markDsnSignalementExported,
} from "@/lib/rh/dsnSignalementsDb";
import { buildPaidLeaveSnapshot } from "@/lib/rh/paidLeave";
import { monthlyContractHours } from "@/lib/rh/payslipMonth";
import {
  employerProfileToPayslipSnapshot,
  type PayslipEmployeeSnapshot,
} from "@/lib/rh/payslipTypes";

export type SignalementActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const SIGNALEMENTS_PATH = "/pilotage/rh/paie/signalements";

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

function revalidateSignalements() {
  revalidatePath("/pilotage/rh/paie");
  revalidatePath(SIGNALEMENTS_PATH);
}

function ymdValid(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

function motifValid(kind: DsnSignalementKind, code: string): boolean {
  const list =
    kind === "arret_travail"
      ? ARRET_MOTIF_OPTIONS
      : kind === "reprise_arret"
        ? REPRISE_MOTIF_OPTIONS
        : FIN_CONTRAT_MOTIF_OPTIONS;
  return list.some((m) => m.code === code);
}

async function loadStaffMember(restaurantId: string, staffMemberId: string) {
  const { data, error } = await supabaseServer
    .from("staff_members")
    .select(
      "id, display_name, role_label, contract_type, target_weekly_hours, paid_leave_balance_days, active"
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", staffMemberId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

async function findStaffContract(restaurantId: string, staffMemberId: string) {
  const contracts = await listHcrContracts(restaurantId);
  return contracts.find((c) => c.staffMemberId === staffMemberId) ?? null;
}

function buildEmployeeSnapshot(
  staff: Record<string, unknown>,
  staffMemberId: string,
  contract: Awaited<ReturnType<typeof findStaffContract>>
): PayslipEmployeeSnapshot {
  const weekly = contract?.draft.jobAndPay.weeklyHours ?? (staff.target_weekly_hours as number | null);
  return {
    staffMemberId,
    displayName: String(staff.display_name ?? ""),
    roleLabel: staff.role_label ? String(staff.role_label) : null,
    contractType: staff.contract_type ? String(staff.contract_type) : null,
    socialSecurityNumber: contract?.draft.employee.socialSecurityNumber?.trim() || null,
    firstName: contract?.draft.employee.firstName ?? null,
    lastName: contract?.draft.employee.lastName ?? null,
    jobTitle: contract?.draft.jobAndPay.jobTitle ?? (staff.role_label ? String(staff.role_label) : null),
    targetWeeklyHours: weekly ?? null,
    monthlyContractHours: monthlyContractHours(weekly),
    paidLeave: buildPaidLeaveSnapshot({
      balanceDays:
        staff.paid_leave_balance_days != null ? Number(staff.paid_leave_balance_days) : 0,
    }),
  };
}

export async function createDsnSignalementAction(params: {
  restaurantId: string;
  staffMemberId: string;
  kind: DsnSignalementKind;
  eventDate: string;
  lastWorkedDay?: string | null;
  expectedEndDate?: string | null;
  returnDate?: string | null;
  contractEndDate?: string | null;
  motifCode: string;
  subrogation?: boolean;
  linkedArretId?: string | null;
  notes?: string | null;
}): Promise<SignalementActionResult<{ signalementId: string }>> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  if (!ymdValid(params.eventDate)) return { ok: false, error: "Date d'événement invalide." };
  if (!motifValid(params.kind, params.motifCode)) {
    return { ok: false, error: "Motif invalide pour ce type de signalement." };
  }

  const profile = await getEmployerProfile(params.restaurantId);
  if (!profile?.siret?.trim()) {
    return { ok: false, error: "Complétez le SIRET dans Administratif avant un signalement DSN." };
  }

  const staff = await loadStaffMember(params.restaurantId, params.staffMemberId);
  if (!staff) return { ok: false, error: "Salarié introuvable." };

  const contract = await findStaffContract(params.restaurantId, params.staffMemberId);
  const employeeSnapshot = buildEmployeeSnapshot(staff, params.staffMemberId, contract);
  if (!employeeSnapshot.socialSecurityNumber?.trim()) {
    return {
      ok: false,
      error: "N° de sécurité sociale manquant — complétez le contrat HCR du salarié.",
    };
  }

  if (params.kind === "arret_travail") {
    if (!params.lastWorkedDay || !ymdValid(params.lastWorkedDay)) {
      return { ok: false, error: "Date du dernier jour travaillé obligatoire." };
    }
  } else if (params.kind === "reprise_arret") {
    if (!params.returnDate || !ymdValid(params.returnDate)) {
      return { ok: false, error: "Date de reprise obligatoire." };
    }
    if (!params.lastWorkedDay || !ymdValid(params.lastWorkedDay)) {
      return { ok: false, error: "Date du dernier jour travaillé (arrêt initial) obligatoire." };
    }
  } else if (params.kind === "fin_contrat") {
    if (!params.contractEndDate || !ymdValid(params.contractEndDate)) {
      return { ok: false, error: "Date de fin de contrat obligatoire." };
    }
  }

  try {
    const row = await insertDsnSignalement({
      restaurantId: params.restaurantId,
      staffMemberId: params.staffMemberId,
      kind: params.kind,
      eventDate: params.eventDate,
      lastWorkedDay: params.lastWorkedDay ?? null,
      expectedEndDate: params.expectedEndDate ?? null,
      returnDate: params.returnDate ?? null,
      contractEndDate: params.contractEndDate ?? null,
      motifCode: params.motifCode,
      subrogation: params.subrogation ?? false,
      linkedArretId: params.linkedArretId ?? null,
      notes: params.notes ?? null,
      employeeSnapshot,
      employerSnapshot: employerProfileToPayslipSnapshot(profile),
    });
    revalidateSignalements();
    return { ok: true, data: { signalementId: row.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Création impossible." };
  }
}

export async function exportDsnSignalementAction(params: {
  restaurantId: string;
  signalementId: string;
  mode?: "test" | "real";
}): Promise<
  SignalementActionResult<{
    filename: string;
    contentBase64: string;
    warnings: string[];
    lineCount: number;
  }>
> {
  const authz = await gateOwner(params.restaurantId);
  if (!authz.ok) return authz;

  const user = await getCurrentUser();
  const signalement = await getDsnSignalement(params.restaurantId, params.signalementId);
  if (!signalement) return { ok: false, error: "Signalement introuvable." };

  const contract = await findStaffContract(params.restaurantId, signalement.staffMemberId);
  const contractStart =
    contract?.draft.termDetails?.startDate?.slice(0, 10) ??
    signalement.eventDate.slice(0, 7) + "-01";

  try {
    const profile = await getEmployerProfile(params.restaurantId);
    const result = buildSignalementDsn({
      signalement,
      mode: params.mode ?? "real",
      contactName: profile?.representativeName,
      contractStartYmd: contractStart,
    });

    await insertDsnSignalementExport({
      signalementId: signalement.id,
      restaurantId: params.restaurantId,
      eventDate: signalement.eventDate,
      exportKind: signalement.kind,
      mode: params.mode ?? "real",
      lineCount: result.lineCount,
      warnings: result.warnings,
      generatedBy: user?.id ?? null,
    });
    await markDsnSignalementExported(signalement.id);

    const contentBase64 = Buffer.from(result.content, "latin1").toString("base64");
    revalidateSignalements();
    return {
      ok: true,
      data: {
        filename: result.filename,
        contentBase64,
        warnings: result.warnings,
        lineCount: result.lineCount,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Export DSN impossible." };
  }
}
