import {
  actualDurationMinutes,
  netPlannedMinutes,
} from "@/lib/staff/timeHelpers";
import type { WorkShiftWithDetails } from "@/lib/staff/types";
import { parisDayFromIso, parisYmFromIso, round2 } from "@/lib/rh/payslipMonth";
import type { HoursSource } from "@/lib/rh/payslipTypes";

export type AggregatedShiftHour = {
  workShiftId: string;
  day: string;
  label: string;
  plannedHours: number;
  attendanceHours: number | null;
  sourceHours: number;
  incompleteAttendance: boolean;
};

export type StaffMonthlyHoursAggregate = {
  staffMemberId: string;
  displayName: string;
  roleLabel: string | null;
  shifts: AggregatedShiftHour[];
  totalPlannedHours: number;
  totalAttendanceHours: number | null;
  totalSourceHours: number;
  incompleteAttendanceCount: number;
};

function shiftLabel(shift: WorkShiftWithDetails): string {
  const start = new Date(shift.starts_at);
  const end = new Date(shift.ends_at);
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function attendanceHoursForShift(shift: WorkShiftWithDetails): {
  hours: number | null;
  incomplete: boolean;
} {
  const att = shift.attendance;
  if (!att?.clock_in_at && !att?.clock_out_at) {
    return { hours: null, incomplete: false };
  }
  const minutes = actualDurationMinutes(att.clock_in_at, att.clock_out_at);
  if (minutes == null) return { hours: null, incomplete: true };
  return { hours: round2(minutes / 60), incomplete: false };
}

export function aggregateMonthlyHours(
  shifts: WorkShiftWithDetails[],
  periodYm: string,
  hoursSource: HoursSource
): StaffMonthlyHoursAggregate[] {
  const byStaff = new Map<string, StaffMonthlyHoursAggregate>();

  for (const shift of shifts) {
    const ym = parisYmFromIso(shift.starts_at);
    if (ym !== periodYm) continue;

    const plannedMinutes = netPlannedMinutes(shift.starts_at, shift.ends_at, shift.break_minutes);
    const plannedHours = round2(plannedMinutes / 60);
    const { hours: attendanceHours, incomplete } = attendanceHoursForShift(shift);

    let sourceHours = plannedHours;
    if (hoursSource === "attendance") {
      if (attendanceHours != null) sourceHours = attendanceHours;
      else {
        sourceHours = plannedHours;
      }
    }

    const staffId = shift.staff_member_id;
    let agg = byStaff.get(staffId);
    if (!agg) {
      agg = {
        staffMemberId: staffId,
        displayName: shift.staff_display_name,
        roleLabel: shift.staff_role_label,
        shifts: [],
        totalPlannedHours: 0,
        totalAttendanceHours: null,
        totalSourceHours: 0,
        incompleteAttendanceCount: 0,
      };
      byStaff.set(staffId, agg);
    }

    agg.shifts.push({
      workShiftId: shift.id,
      day: parisDayFromIso(shift.starts_at),
      label: shiftLabel(shift),
      plannedHours,
      attendanceHours,
      sourceHours,
      incompleteAttendance: incomplete,
    });
    agg.totalPlannedHours = round2(agg.totalPlannedHours + plannedHours);
    agg.totalSourceHours = round2(agg.totalSourceHours + sourceHours);
    if (incomplete) agg.incompleteAttendanceCount += 1;
    if (attendanceHours != null) {
      agg.totalAttendanceHours = round2((agg.totalAttendanceHours ?? 0) + attendanceHours);
    }
  }

  for (const agg of byStaff.values()) {
    agg.shifts.sort((a, b) => a.day.localeCompare(b.day) || a.label.localeCompare(b.label));
  }

  return [...byStaff.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
}
