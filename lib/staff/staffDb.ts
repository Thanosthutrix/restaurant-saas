import { getRestaurantById, type Restaurant } from "@/lib/auth";
import type { PlanningDayOverrideRow } from "@/lib/staff/planningResolve";
import { parsePlanningBandPresetsJson } from "@/lib/staff/planningBandPresets";
import { parseStaffTargetsWeeklyJson } from "@/lib/staff/planningResolve";
import { parseOpeningHoursJson } from "@/lib/staff/planningHoursTypes";
import { supabaseServer } from "@/lib/supabaseServer";
import type { StaffMember, WorkShift, WorkShiftWithDetails } from "./types";

function mapStaff(row: Record<string, unknown>): StaffMember {
  const tw = row.target_weekly_hours;
  const target =
    tw == null || tw === ""
      ? null
      : Number.isFinite(Number(tw))
        ? Number(tw)
        : null;
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    display_name: String(row.display_name ?? "").trim(),
    user_id: row.user_id == null ? null : String(row.user_id),
    role_label: row.role_label == null || String(row.role_label).trim() === "" ? null : String(row.role_label).trim(),
    app_role: row.app_role == null || String(row.app_role).trim() === "" ? null : String(row.app_role).trim(),
    contract_type:
      row.contract_type == null || String(row.contract_type).trim() === ""
        ? null
        : String(row.contract_type).trim(),
    target_weekly_hours: target,
    planning_notes:
      row.planning_notes == null || String(row.planning_notes).trim() === ""
        ? null
        : String(row.planning_notes).trim(),
    availability_json:
      row.availability_json != null && typeof row.availability_json === "object"
        ? (row.availability_json as Record<string, unknown>)
        : null,
    planning_prep_bands_json:
      row.planning_prep_bands_json != null && typeof row.planning_prep_bands_json === "object"
        ? (row.planning_prep_bands_json as Record<string, unknown>)
        : null,
    active: Boolean(row.active),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Fiche staff + restaurant pour le shell et les droits (un compte = une fiche active par restaurant ciblé). */
export async function getStaffMembershipForAccess(userId: string): Promise<{
  staff_member_id: string;
  restaurant_id: string;
  restaurant_name: string;
  app_role: string | null;
  restaurant: Restaurant;
} | null> {
  const { data, error } = await supabaseServer
    .from("staff_members")
    .select("id, restaurant_id, app_role")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const restaurant_id = String((data as { restaurant_id: string }).restaurant_id);
  const restaurant = await getRestaurantById(restaurant_id);
  if (!restaurant) return null;

  return {
    staff_member_id: String((data as { id: string }).id),
    restaurant_id,
    restaurant_name: restaurant.name,
    app_role: (data as { app_role: string | null }).app_role,
    restaurant,
  };
}

function mapShift(row: Record<string, unknown>): WorkShift {
  const br = row.break_minutes;
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    staff_member_id: String(row.staff_member_id),
    starts_at: String(row.starts_at ?? ""),
    ends_at: String(row.ends_at ?? ""),
    break_minutes:
      br == null || br === ""
        ? null
        : Number.isFinite(Number(br))
          ? Number(br)
          : null,
    notes: row.notes == null || String(row.notes).trim() === "" ? null : String(row.notes).trim(),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listStaffMembers(restaurantId: string, activeOnly = true): Promise<StaffMember[]> {
  let q = supabaseServer.from("staff_members").select("*").eq("restaurant_id", restaurantId).order("display_name");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapStaff);
}

export async function getStaffMemberById(
  restaurantId: string,
  id: string
): Promise<StaffMember | null> {
  const { data, error } = await supabaseServer
    .from("staff_members")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapStaff(data as Record<string, unknown>);
}

export async function getStaffMemberByUserAndRestaurant(
  userId: string,
  restaurantId: string
): Promise<StaffMember | null> {
  const { data, error } = await supabaseServer
    .from("staff_members")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapStaff(data as Record<string, unknown>);
}

export async function getWorkShiftById(
  restaurantId: string,
  shiftId: string
): Promise<WorkShift | null> {
  const { data, error } = await supabaseServer
    .from("work_shifts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", shiftId)
    .maybeSingle();
  if (error || !data) return null;
  return mapShift(data as Record<string, unknown>);
}

export async function getRestaurantPlanningOpeningHours(restaurantId: string) {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("planning_opening_hours")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return parseOpeningHoursJson(null);
  return parseOpeningHoursJson((data as { planning_opening_hours?: unknown }).planning_opening_hours);
}

export async function getRestaurantPlanningStaffTargetsWeekly(restaurantId: string) {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("planning_staff_targets_weekly")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return parseStaffTargetsWeeklyJson(null);
  return parseStaffTargetsWeeklyJson(
    (data as { planning_staff_targets_weekly?: unknown }).planning_staff_targets_weekly
  );
}

export async function getRestaurantPlanningBandPresets(restaurantId: string) {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("planning_band_presets")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return parsePlanningBandPresetsJson(null);
  return parsePlanningBandPresetsJson(
    (data as { planning_band_presets?: unknown }).planning_band_presets
  );
}

export async function listPlanningDayOverridesInRange(
  restaurantId: string,
  fromYmdInclusive: string,
  toYmdExclusive: string
): Promise<PlanningDayOverrideRow[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_planning_day_overrides")
    .select("day, is_closed, opening_bands_override, staff_target_override, label, calendar_source")
    .eq("restaurant_id", restaurantId)
    .gte("day", fromYmdInclusive)
    .lt("day", toYmdExclusive)
    .order("day", { ascending: true });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    day: String(row.day).slice(0, 10),
    is_closed: Boolean(row.is_closed),
    opening_bands_override: row.opening_bands_override,
    staff_target_override:
      row.staff_target_override == null || row.staff_target_override === ""
        ? null
        : Number(row.staff_target_override),
    label: row.label == null || String(row.label).trim() === "" ? null : String(row.label).trim(),
    calendar_source:
      row.calendar_source === "public_holiday" || row.calendar_source === "school_vacation"
        ? row.calendar_source
        : null,
  }));
}

export async function listWorkShiftsInRange(
  restaurantId: string,
  rangeStartIso: string,
  rangeEndExclusiveIso: string
): Promise<WorkShiftWithDetails[]> {
  const { data: shifts, error } = await supabaseServer
    .from("work_shifts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .lt("starts_at", rangeEndExclusiveIso)
    .gt("ends_at", rangeStartIso)
    .order("starts_at", { ascending: true });

  if (error) return [];
  if (!shifts?.length) return [];

  const staffIds = [...new Set((shifts as Record<string, unknown>[]).map((s) => String(s.staff_member_id)))];
  const { data: staffRows } = await supabaseServer
    .from("staff_members")
    .select("id, display_name, role_label")
    .in("id", staffIds);

  const shiftIds = (shifts as Record<string, unknown>[]).map((s) => String(s.id));
  const { data: attendRows } = await supabaseServer
    .from("shift_attendance")
    .select("work_shift_id, clock_in_at, clock_out_at")
    .in("work_shift_id", shiftIds);

  const staffMap = new Map(
    (staffRows ?? []).map((r) => [
      String((r as { id: string }).id),
      {
        display_name: String((r as { display_name: string }).display_name ?? ""),
        role_label: (r as { role_label: string | null }).role_label,
      },
    ])
  );
  const attMap = new Map(
    (attendRows ?? []).map((a) => [
      String((a as { work_shift_id: string }).work_shift_id),
      {
        clock_in_at: (a as { clock_in_at: string | null }).clock_in_at,
        clock_out_at: (a as { clock_out_at: string | null }).clock_out_at,
      },
    ])
  );

  return (shifts as Record<string, unknown>[]).map((row) => {
    const s = mapShift(row);
    const st = staffMap.get(s.staff_member_id);
    const att = attMap.get(s.id);
    return {
      ...s,
      staff_display_name: st?.display_name ?? "—",
      staff_role_label:
        st?.role_label == null || String(st.role_label).trim() === "" ? null : String(st.role_label).trim(),
      attendance: att
        ? { clock_in_at: att.clock_in_at ?? null, clock_out_at: att.clock_out_at ?? null }
        : null,
    };
  });
}

export async function getPlanningWeekSimulation(
  restaurantId: string,
  weekMondayYmd: string
): Promise<{ id: string; week_monday: string } | null> {
  const { data, error } = await supabaseServer
    .from("planning_week_simulations")
    .select("id, week_monday")
    .eq("restaurant_id", restaurantId)
    .eq("week_monday", weekMondayYmd)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String((data as { id: string }).id),
    week_monday: String((data as { week_monday: string }).week_monday).slice(0, 10),
  };
}

function mapSimulationShiftRow(row: Record<string, unknown>, restaurantId: string): WorkShift {
  const br = row.break_minutes;
  return {
    id: String(row.id),
    restaurant_id: restaurantId,
    staff_member_id: String(row.staff_member_id),
    starts_at: String(row.starts_at ?? ""),
    ends_at: String(row.ends_at ?? ""),
    break_minutes:
      br == null || br === ""
        ? null
        : Number.isFinite(Number(br))
          ? Number(br)
          : null,
    notes: row.notes == null || String(row.notes).trim() === "" ? null : String(row.notes).trim(),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listSimulationShiftsWithDetails(
  restaurantId: string,
  simulationId: string
): Promise<WorkShiftWithDetails[]> {
  const { data: sim, error: eSim } = await supabaseServer
    .from("planning_week_simulations")
    .select("id")
    .eq("id", simulationId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (eSim || !sim) return [];

  const { data: shifts, error } = await supabaseServer
    .from("planning_simulation_shifts")
    .select("*")
    .eq("simulation_id", simulationId)
    .order("starts_at", { ascending: true });

  if (error) return [];
  if (!shifts?.length) return [];

  const staffIds = [...new Set((shifts as Record<string, unknown>[]).map((s) => String(s.staff_member_id)))];
  const { data: staffRows } = await supabaseServer
    .from("staff_members")
    .select("id, display_name, role_label")
    .in("id", staffIds);

  const staffMap = new Map(
    (staffRows ?? []).map((r) => [
      String((r as { id: string }).id),
      {
        display_name: String((r as { display_name: string }).display_name ?? ""),
        role_label: (r as { role_label: string | null }).role_label,
      },
    ])
  );

  return (shifts as Record<string, unknown>[]).map((row) => {
    const s = mapSimulationShiftRow(row, restaurantId);
    const st = staffMap.get(s.staff_member_id);
    return {
      ...s,
      staff_display_name: st?.display_name ?? "—",
      staff_role_label:
        st?.role_label == null || String(st.role_label).trim() === "" ? null : String(st.role_label).trim(),
      attendance: null,
      isSimulationDraft: true,
    };
  });
}

/** Shifts à venir ou en cours pour un collaborateur (pointage). */
export async function listWorkShiftsForStaffFrom(
  restaurantId: string,
  staffMemberId: string,
  fromIso: string,
  limit = 40
): Promise<WorkShiftWithDetails[]> {
  const { data: shifts, error } = await supabaseServer
    .from("work_shifts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("staff_member_id", staffMemberId)
    .gte("ends_at", fromIso)
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error || !shifts?.length) return [];

  const shiftIds = (shifts as Record<string, unknown>[]).map((s) => String(s.id));
  const { data: attendRows } = await supabaseServer
    .from("shift_attendance")
    .select("work_shift_id, clock_in_at, clock_out_at")
    .in("work_shift_id", shiftIds);

  const attMap = new Map(
    (attendRows ?? []).map((a) => [
      String((a as { work_shift_id: string }).work_shift_id),
      {
        clock_in_at: (a as { clock_in_at: string | null }).clock_in_at,
        clock_out_at: (a as { clock_out_at: string | null }).clock_out_at,
      },
    ])
  );

  const { data: st } = await supabaseServer
    .from("staff_members")
    .select("display_name, role_label")
    .eq("id", staffMemberId)
    .maybeSingle();

  const display_name = String((st as { display_name?: string } | null)?.display_name ?? "—");
  const role_label = (st as { role_label: string | null } | null)?.role_label ?? null;

  return (shifts as Record<string, unknown>[]).map((row) => {
    const s = mapShift(row);
    const att = attMap.get(s.id);
    return {
      ...s,
      staff_display_name: display_name,
      staff_role_label: role_label == null || String(role_label).trim() === "" ? null : String(role_label).trim(),
      attendance: att
        ? { clock_in_at: att.clock_in_at ?? null, clock_out_at: att.clock_out_at ?? null }
        : null,
    };
  });
}
