import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import type { OpeningHoursMap } from "@/lib/staff/planningHoursTypes";
import { parseOpeningHoursJson } from "@/lib/staff/planningHoursTypes";

export type PlatformStaffMember = {
  id: string;
  company_id: string;
  display_name: string;
  role_label: string | null;
  hourly_gross_rate: number | null;
  withholding_tax_rate_pct: number | null;
  color_index: number | null;
  target_weekly_hours: number | null;
  planning_carryover_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlatformWorkShiftRow = {
  id: string;
  company_id: string;
  staff_member_id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number | null;
  notes: string | null;
};

const STAFF_SELECT =
  "id, company_id, display_name, role_label, hourly_gross_rate, withholding_tax_rate_pct, color_index, target_weekly_hours, planning_carryover_minutes, active, created_at, updated_at";

function mapStaff(row: Record<string, unknown>): PlatformStaffMember {
  return {
    ...(row as PlatformStaffMember),
    hourly_gross_rate: row.hourly_gross_rate != null ? Number(row.hourly_gross_rate) : null,
    withholding_tax_rate_pct:
      row.withholding_tax_rate_pct != null ? Number(row.withholding_tax_rate_pct) : null,
    color_index: row.color_index != null ? Number(row.color_index) : null,
    target_weekly_hours: row.target_weekly_hours != null ? Number(row.target_weekly_hours) : null,
    planning_carryover_minutes: Number(row.planning_carryover_minutes) || 0,
  };
}

export async function listPlatformStaffMembers(companyId: string): Promise<PlatformStaffMember[]> {
  const { data, error } = await supabaseServer
    .from("platform_staff_members")
    .select(STAFF_SELECT)
    .eq("company_id", companyId)
    .eq("active", true)
    .order("display_name");
  if (error) throw error;
  return (data ?? []).map((r) => mapStaff(r as Record<string, unknown>));
}

export async function listAllPlatformStaffMembers(companyId: string): Promise<PlatformStaffMember[]> {
  const { data, error } = await supabaseServer
    .from("platform_staff_members")
    .select(STAFF_SELECT)
    .eq("company_id", companyId)
    .order("display_name");
  if (error) throw error;
  return (data ?? []).map((r) => mapStaff(r as Record<string, unknown>));
}

export async function getPlatformStaffMember(
  companyId: string,
  staffId: string
): Promise<PlatformStaffMember | null> {
  const { data, error } = await supabaseServer
    .from("platform_staff_members")
    .select(STAFF_SELECT)
    .eq("company_id", companyId)
    .eq("id", staffId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapStaff(data as Record<string, unknown>) : null;
}

export async function createPlatformStaffMember(params: {
  companyId: string;
  displayName: string;
  roleLabel?: string | null;
  hourlyGrossRate?: number | null;
  targetWeeklyHours?: number | null;
}): Promise<PlatformStaffMember> {
  const { data, error } = await supabaseServer
    .from("platform_staff_members")
    .insert({
      company_id: params.companyId,
      display_name: params.displayName.trim(),
      role_label: params.roleLabel?.trim() || null,
      hourly_gross_rate: params.hourlyGrossRate ?? null,
      target_weekly_hours: params.targetWeeklyHours ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(STAFF_SELECT)
    .single();
  if (error || !data) throw error ?? new Error("Création collaborateur impossible.");
  return mapStaff(data as Record<string, unknown>);
}

export async function deactivatePlatformStaffMember(companyId: string, staffId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("platform_staff_members")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", staffId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function updatePlatformStaffHourlyRate(
  companyId: string,
  staffId: string,
  hourlyGrossRate: number | null
): Promise<void> {
  const { error } = await supabaseServer
    .from("platform_staff_members")
    .update({ hourly_gross_rate: hourlyGrossRate, updated_at: new Date().toISOString() })
    .eq("id", staffId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function updatePlatformStaffTargetHours(
  companyId: string,
  staffId: string,
  targetWeeklyHours: number | null
): Promise<void> {
  const { error } = await supabaseServer
    .from("platform_staff_members")
    .update({ target_weekly_hours: targetWeeklyHours, updated_at: new Date().toISOString() })
    .eq("id", staffId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function listPlatformWorkShiftsInRange(
  companyId: string,
  fromIso: string,
  toIso: string
): Promise<PlatformWorkShiftRow[]> {
  const { data, error } = await supabaseServer
    .from("platform_work_shifts")
    .select("id, company_id, staff_member_id, starts_at, ends_at, break_minutes, notes")
    .eq("company_id", companyId)
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at");
  if (error) throw error;
  return (data ?? []) as PlatformWorkShiftRow[];
}

export async function getPlatformWorkShift(
  companyId: string,
  shiftId: string
): Promise<PlatformWorkShiftRow | null> {
  const { data, error } = await supabaseServer
    .from("platform_work_shifts")
    .select("id, company_id, staff_member_id, starts_at, ends_at, break_minutes, notes")
    .eq("company_id", companyId)
    .eq("id", shiftId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlatformWorkShiftRow | null) ?? null;
}

export async function insertPlatformWorkShift(params: {
  companyId: string;
  staffMemberId: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  breakMinutes?: number | null;
}): Promise<{ id: string }> {
  const { data, error } = await supabaseServer
    .from("platform_work_shifts")
    .insert({
      company_id: params.companyId,
      staff_member_id: params.staffMemberId,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      notes: params.notes?.trim() || null,
      break_minutes: params.breakMinutes ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Création créneau impossible.");
  return { id: (data as { id: string }).id };
}

export async function updatePlatformWorkShiftTimes(
  companyId: string,
  shiftId: string,
  startsAt: string,
  endsAt: string
): Promise<void> {
  const { error } = await supabaseServer
    .from("platform_work_shifts")
    .update({ starts_at: startsAt, ends_at: endsAt, updated_at: new Date().toISOString() })
    .eq("id", shiftId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function deletePlatformWorkShift(companyId: string, shiftId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("platform_work_shifts")
    .delete()
    .eq("id", shiftId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function getPlatformPlanningSettings(companyId: string): Promise<{
  securityFloor: number;
  officeHoursJson: unknown;
}> {
  const { data } = await supabaseServer
    .from("platform_companies")
    .select("planning_security_floor, planning_office_hours_json")
    .eq("id", companyId)
    .maybeSingle();
  const row = data as { planning_security_floor?: unknown; planning_office_hours_json?: unknown } | null;
  return {
    securityFloor: Math.max(1, Number(row?.planning_security_floor) || 1),
    officeHoursJson: row?.planning_office_hours_json ?? null,
  };
}

export async function applyPlatformWeekDeltaToCarryover(
  companyId: string,
  weekMondayIso: string,
  weekEndExclusiveIso: string
): Promise<number> {
  const [staff, shifts] = await Promise.all([
    listPlatformStaffMembers(companyId),
    listPlatformWorkShiftsInRange(companyId, weekMondayIso + "T00:00:00.000Z", weekEndExclusiveIso),
  ]);

  const t0 = Date.parse(weekMondayIso + "T00:00:00.000Z");
  const t1 = Date.parse(weekEndExclusiveIso);
  let updated = 0;

  for (const member of staff) {
    const target = member.target_weekly_hours;
    if (target == null || !Number.isFinite(target) || target <= 0) continue;

    let plannedMin = 0;
    for (const sh of shifts) {
      if (sh.staff_member_id !== member.id) continue;
      const a = Date.parse(sh.starts_at);
      if (a < t0 || a >= t1) continue;
      const start = new Date(sh.starts_at);
      const end = new Date(sh.ends_at);
      const gross = Math.max(0, (end.getTime() - start.getTime()) / 60000);
      plannedMin += gross - (sh.break_minutes ?? 0);
    }

    const targetMin = Math.round(target * 60);
    const delta = targetMin - plannedMin;
    const newCarry = (member.planning_carryover_minutes ?? 0) + delta;

    const { error } = await supabaseServer
      .from("platform_staff_members")
      .update({ planning_carryover_minutes: newCarry, updated_at: new Date().toISOString() })
      .eq("id", member.id)
      .eq("company_id", companyId);
    if (!error) updated++;
  }

  return updated;
}

export async function updatePlatformOfficeHours(companyId: string, hours: OpeningHoursMap): Promise<void> {
  const { error } = await supabaseServer
    .from("platform_companies")
    .update({
      planning_office_hours_json: hours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);
  if (error) throw error;
}

export async function updatePlatformPlanningSecurityFloor(companyId: string, floor: number): Promise<void> {
  const { error } = await supabaseServer
    .from("platform_companies")
    .update({
      planning_security_floor: floor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);
  if (error) throw error;
}

export function normalizePlatformOfficeHours(raw: unknown): OpeningHoursMap {
  const parsed = parseOpeningHoursJson(raw);
  if (Object.keys(parsed).length > 0) return parsed;
  return {
    mon: [{ start: "09:00", end: "18:00" }],
    tue: [{ start: "09:00", end: "18:00" }],
    wed: [{ start: "09:00", end: "18:00" }],
    thu: [{ start: "09:00", end: "18:00" }],
    fri: [{ start: "09:00", end: "18:00" }],
    sat: [],
    sun: [],
  };
}
