"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getPlatformCompany } from "@/lib/platform/companyDb";
import { parseLocalDateTimeInput } from "@/lib/staff/parseLocalDateTime";
import {
  applyPlatformWeekDeltaToCarryover,
  createPlatformStaffMember,
  deactivatePlatformStaffMember,
  deletePlatformWorkShift,
  getPlatformStaffMember,
  getPlatformWorkShift,
  insertPlatformWorkShift,
  updatePlatformOfficeHours,
  updatePlatformPlanningSecurityFloor,
  updatePlatformStaffHourlyRate,
  updatePlatformStaffTargetHours,
  updatePlatformWorkShiftTimes,
} from "@/lib/platform/platformStaffDb";
import { parseOpeningHoursJson } from "@/lib/staff/planningHoursTypes";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function gateAdminCompany(): Promise<ActionResult<{ companyId: string }>> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Accès refusé." };
  const company = await getPlatformCompany();
  if (!company) return { ok: false, error: "Configurez d'abord le profil de votre société." };
  return { ok: true, data: { companyId: company.id } };
}

function revalidateTeam() {
  revalidatePath("/admin/company/team");
  revalidatePath("/admin/company/pocket");
}

export async function createPlatformStaffMemberAction(params: {
  displayName: string;
  roleLabel?: string | null;
  hourlyGrossRate?: number | null;
  targetWeeklyHours?: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;
  if (!params.displayName.trim()) return { ok: false, error: "Nom requis." };

  try {
    const member = await createPlatformStaffMember({
      companyId: auth.data!.companyId,
      displayName: params.displayName,
      roleLabel: params.roleLabel,
      hourlyGrossRate: params.hourlyGrossRate,
      targetWeeklyHours: params.targetWeeklyHours,
    });
    revalidateTeam();
    return { ok: true, data: { id: member.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deactivatePlatformStaffMemberAction(staffId: string): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;
  try {
    await deactivatePlatformStaffMember(auth.data!.companyId, staffId);
    revalidateTeam();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setPlatformStaffPlanningProfileAction(params: {
  staffMemberId: string;
  hourlyGrossRate?: number | null;
  targetWeeklyHours?: number | null;
}): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  if (params.hourlyGrossRate != null && (!Number.isFinite(params.hourlyGrossRate) || params.hourlyGrossRate < 0)) {
    return { ok: false, error: "Taux horaire invalide." };
  }
  if (
    params.targetWeeklyHours != null &&
    (!Number.isFinite(params.targetWeeklyHours) || params.targetWeeklyHours < 0 || params.targetWeeklyHours > 60)
  ) {
    return { ok: false, error: "Objectif hebdo invalide (0–60 h)." };
  }

  try {
    if (params.hourlyGrossRate !== undefined) {
      await updatePlatformStaffHourlyRate(auth.data!.companyId, params.staffMemberId, params.hourlyGrossRate);
    }
    if (params.targetWeeklyHours !== undefined) {
      await updatePlatformStaffTargetHours(auth.data!.companyId, params.staffMemberId, params.targetWeeklyHours);
    }
    revalidateTeam();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function createShiftInternal(
  companyId: string,
  payload: {
    staffMemberId: string;
    startsAtLocal: string;
    endsAtLocal: string;
    notes?: string | null;
    breakMinutes?: number | null;
  }
): Promise<ActionResult<{ id: string }>> {
  let starts: Date;
  let ends: Date;
  try {
    starts = parseLocalDateTimeInput(payload.startsAtLocal);
    ends = parseLocalDateTimeInput(payload.endsAtLocal);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Date invalide." };
  }
  if (!(ends > starts)) return { ok: false, error: "La fin doit être après le début." };

  const member = await getPlatformStaffMember(companyId, payload.staffMemberId);
  if (!member?.active) return { ok: false, error: "Collaborateur invalide." };

  try {
    const row = await insertPlatformWorkShift({
      companyId,
      staffMemberId: payload.staffMemberId,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      notes: payload.notes,
      breakMinutes: payload.breakMinutes,
    });
    revalidateTeam();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createPlatformWorkShiftAction(params: {
  staffMemberId: string;
  startsAtLocal: string;
  endsAtLocal: string;
  notes?: string | null;
  breakMinutes?: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;
  return createShiftInternal(auth.data!.companyId, params);
}

export async function updatePlatformWorkShiftTimesAction(
  shiftId: string,
  payload: { startsAtLocal: string; endsAtLocal: string }
): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  const existing = await getPlatformWorkShift(auth.data!.companyId, shiftId);
  if (!existing) return { ok: false, error: "Créneau introuvable." };

  let starts: Date;
  let ends: Date;
  try {
    starts = parseLocalDateTimeInput(payload.startsAtLocal);
    ends = parseLocalDateTimeInput(payload.endsAtLocal);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Date invalide." };
  }
  if (!(ends > starts)) return { ok: false, error: "La fin doit être après le début." };

  try {
    await updatePlatformWorkShiftTimes(
      auth.data!.companyId,
      shiftId,
      starts.toISOString(),
      ends.toISOString()
    );
    revalidateTeam();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deletePlatformWorkShiftAction(shiftId: string): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;
  try {
    await deletePlatformWorkShift(auth.data!.companyId, shiftId);
    revalidateTeam();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function applyPlatformWeekDeltaAction(weekMondayIso: string): Promise<ActionResult<{ updated: number }>> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  const { addDays, parseISODateLocal } = await import("@/lib/staff/weekUtils");
  const monday = parseISODateLocal(weekMondayIso);
  if (!monday) return { ok: false, error: "Semaine invalide." };
  const weekEnd = addDays(monday, 7);

  try {
    const updated = await applyPlatformWeekDeltaToCarryover(
      auth.data!.companyId,
      monday.toISOString(),
      weekEnd.toISOString()
    );
    revalidateTeam();
    return { ok: true, data: { updated } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updatePlatformOfficeHoursAction(
  hours: unknown
): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  const parsed = parseOpeningHoursJson(hours);
  try {
    await updatePlatformOfficeHours(auth.data!.companyId, parsed);
    revalidateTeam();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updatePlatformPlanningSecurityFloorAction(floor: number): Promise<ActionResult> {
  const auth = await gateAdminCompany();
  if (!auth.ok) return auth;

  if (!Number.isFinite(floor) || floor < 1 || floor > 50) {
    return { ok: false, error: "Effectif minimum invalide (1 à 50)." };
  }

  try {
    await updatePlatformPlanningSecurityFloor(auth.data!.companyId, Math.round(floor));
    revalidateTeam();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
