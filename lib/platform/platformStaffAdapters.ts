import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import type { PlatformStaffMember } from "@/lib/platform/platformStaffDb";

export function toStaffMemberAdapter(companyId: string, m: PlatformStaffMember): StaffMember {
  return {
    id: m.id,
    restaurant_id: companyId,
    display_name: m.display_name,
    user_id: null,
    role_label: m.role_label,
    app_role: null,
    app_nav_keys: null,
    contract_type: null,
    contract_start_date: null,
    contract_end_date: null,
    target_weekly_hours: m.target_weekly_hours,
    max_daily_hours: null,
    planning_carryover_minutes: m.planning_carryover_minutes ?? 0,
    planning_notes: null,
    color_index: m.color_index,
    availability_json: null,
    planning_prep_bands_json: null,
    planning_fixed_rest_days: [],
    planning_weekly_rest_days: 0,
    planning_require_consecutive_rest: false,
    planning_default_shift_pattern: null,
    active: m.active,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

export function toWorkShiftWithDetails(
  companyId: string,
  shift: {
    id: string;
    staff_member_id: string;
    starts_at: string;
    ends_at: string;
    break_minutes: number | null;
    notes: string | null;
  },
  staffById: Map<string, PlatformStaffMember>
): WorkShiftWithDetails {
  const member = staffById.get(shift.staff_member_id);
  return {
    id: shift.id,
    restaurant_id: companyId,
    staff_member_id: shift.staff_member_id,
    starts_at: shift.starts_at,
    ends_at: shift.ends_at,
    break_minutes: shift.break_minutes,
    notes: shift.notes,
    created_at: "",
    updated_at: "",
    staff_display_name: member?.display_name ?? "—",
    staff_role_label: member?.role_label ?? null,
    attendance: null,
  };
}
