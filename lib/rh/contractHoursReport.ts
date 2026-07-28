import "server-only";

import {
  contractKindLabel,
  contractLifecycle,
  pickStaffHcrContract,
  staffContractTermsFromRow,
  type StaffContractTerms,
} from "@/lib/hcr-contracts/contractTerms";
import { listHcrContracts } from "@/lib/hcr-contracts/hcrContractsDb";
import {
  actualDurationMinutes,
  netPlannedMinutes,
} from "@/lib/staff/timeHelpers";
import { listWorkShiftsInRange } from "@/lib/staff/staffDb";
import type { WorkShiftWithDetails } from "@/lib/staff/types";
import {
  expectedHoursForDateRange,
  intersectPeriod,
  monthEndYmd,
  todayYmdParis,
  weekSlicesForRange,
} from "@/lib/rh/contractHoursProrata";
import {
  formatPeriodMonthLabel,
  monthRangeIso,
  monthStartYmd,
  parisDayFromIso,
  round2,
} from "@/lib/rh/payslipMonth";
import { supabaseServer } from "@/lib/supabaseServer";
import { toPlanningYmdFromUnknown } from "@/lib/staff/weekUtils";

function toStaffYmd(raw: unknown): string | null {
  return toPlanningYmdFromUnknown(raw);
}

export type ContractHoursWeekRow = {
  weekStart: string;
  weekEnd: string;
  expectedHours: number;
  plannedHours: number;
  attendanceHours: number | null;
  deltaPlanned: number;
  deltaAttendance: number | null;
};

export type ContractHoursReportRow = {
  staffMemberId: string;
  staffDisplayName: string;
  contractId: string | null;
  contractKind: string;
  contractStatus: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  weeklyContractHours: number;
  lifecycle: ReturnType<typeof contractLifecycle>;
  missingContractDates: boolean;
  /** Période affichée (mois sélectionné ∩ contrat). */
  monthFrom: string;
  monthTo: string;
  monthExpectedHours: number;
  monthPlannedHours: number;
  monthAttendanceHours: number | null;
  monthDeltaPlanned: number;
  monthDeltaAttendance: number | null;
  monthOvertimePlanned: boolean;
  /** Cumul depuis le début du contrat jusqu'à aujourd'hui (ou fin CDD). */
  cumulativeFrom: string | null;
  cumulativeTo: string | null;
  cumulativeExpectedHours: number;
  cumulativePlannedHours: number;
  cumulativeAttendanceHours: number | null;
  cumulativeDeltaPlanned: number;
  cumulativeDeltaAttendance: number | null;
  cumulativeOvertimePlanned: boolean;
  incompleteAttendanceCount: number;
  weeks: ContractHoursWeekRow[];
};

export type ContractHoursReport = {
  periodYm: string;
  periodLabel: string;
  generatedAt: string;
  rows: ContractHoursReportRow[];
};

type StaffRow = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  contractType: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  targetWeeklyHours: number | null;
  active: boolean;
};

function shiftHours(shift: WorkShiftWithDetails): {
  planned: number;
  attendance: number | null;
  incomplete: boolean;
} {
  const plannedMinutes = netPlannedMinutes(shift.starts_at, shift.ends_at, shift.break_minutes);
  const att = shift.attendance;
  let attendance: number | null = null;
  let incomplete = false;
  if (att?.clock_in_at || att?.clock_out_at) {
    const minutes = actualDurationMinutes(att.clock_in_at, att.clock_out_at);
    if (minutes == null) incomplete = true;
    else attendance = round2(minutes / 60);
  }
  return {
    planned: round2(plannedMinutes / 60),
    attendance,
    incomplete,
  };
}

function aggregateHoursForStaff(
  shifts: WorkShiftWithDetails[],
  staffMemberId: string,
  fromYmd: string,
  toYmd: string
): { planned: number; attendance: number | null; incompleteCount: number } {
  let planned = 0;
  let attendanceSum = 0;
  let hasAttendance = false;
  let incompleteCount = 0;

  for (const shift of shifts) {
    if (shift.staff_member_id !== staffMemberId) continue;
    const day = parisDayFromIso(shift.starts_at);
    if (day < fromYmd || day > toYmd) continue;
    const h = shiftHours(shift);
    planned = round2(planned + h.planned);
    if (h.incomplete) incompleteCount += 1;
    if (h.attendance != null) {
      hasAttendance = true;
      attendanceSum = round2(attendanceSum + h.attendance);
    }
  }

  return {
    planned,
    attendance: hasAttendance ? attendanceSum : null,
    incompleteCount,
  };
}

function buildRowFromTerms(params: {
  terms: StaffContractTerms;
  staff: StaffRow;
  periodYm: string;
  todayYmd: string;
  monthStart: string;
  monthEnd: string;
  shifts: WorkShiftWithDetails[];
}): ContractHoursReportRow | null {
  const { terms, staff, periodYm, todayYmd, monthStart, monthEnd, shifts } = params;
  const weekly = terms.weeklyHours;

  const monthWindow = intersectPeriod(
    monthStart,
    monthEnd,
    terms.startDate,
    terms.endDate ?? monthEnd
  );
  if (!monthWindow) return null;

  const cumulativeFrom = terms.startDate ?? (terms.isTermContract ? null : `${periodYm.split("-")[0]}-01-01`);
  const cumulativeTo = terms.endDate
    ? minYmdLocal(terms.endDate, todayYmd)
    : todayYmd;

  let cumulativeExpected = 0;
  let cumulativePlanned = 0;
  let cumulativeAttendance: number | null = null;

  if (cumulativeFrom && cumulativeFrom <= cumulativeTo) {
    cumulativeExpected = expectedHoursForDateRange(weekly, cumulativeFrom, cumulativeTo);
    const cum = aggregateHoursForStaff(shifts, terms.staffMemberId, cumulativeFrom, cumulativeTo);
    cumulativePlanned = cum.planned;
    cumulativeAttendance = cum.attendance;
  }

  const monthExpected = expectedHoursForDateRange(weekly, monthWindow.from, monthWindow.to);
  const monthAgg = aggregateHoursForStaff(
    shifts,
    terms.staffMemberId,
    monthWindow.from,
    monthWindow.to
  );

  const weekSlices = weekSlicesForRange(weekly, monthWindow.from, monthWindow.to);
  const weeks: ContractHoursWeekRow[] = weekSlices.map((slice) => {
    const agg = aggregateHoursForStaff(
      shifts,
      terms.staffMemberId,
      slice.weekStart,
      slice.weekEnd
    );
    return {
      weekStart: slice.weekStart,
      weekEnd: slice.weekEnd,
      expectedHours: slice.expectedHours,
      plannedHours: agg.planned,
      attendanceHours: agg.attendance,
      deltaPlanned: round2(agg.planned - slice.expectedHours),
      deltaAttendance:
        agg.attendance != null ? round2(agg.attendance - slice.expectedHours) : null,
    };
  });

  const monthDeltaPlanned = round2(monthAgg.planned - monthExpected);
  const monthDeltaAttendance =
    monthAgg.attendance != null ? round2(monthAgg.attendance - monthExpected) : null;

  const cumulativeDeltaPlanned =
    cumulativeFrom && cumulativeFrom <= cumulativeTo
      ? round2(cumulativePlanned - cumulativeExpected)
      : 0;
  const cumulativeDeltaAttendance =
    cumulativeAttendance != null && cumulativeFrom
      ? round2(cumulativeAttendance - cumulativeExpected)
      : null;

  return {
    staffMemberId: terms.staffMemberId,
    staffDisplayName: staff.displayName || terms.displayName,
    contractId: terms.contractId,
    contractKind: contractKindLabel(terms.contractKind),
    contractStatus: terms.status,
    contractStart: terms.startDate,
    contractEnd: terms.endDate,
    weeklyContractHours: weekly,
    lifecycle: contractLifecycle(terms.startDate, terms.endDate, todayYmd),
    missingContractDates: terms.isTermContract && !terms.startDate,
    monthFrom: monthWindow.from,
    monthTo: monthWindow.to,
    monthExpectedHours: monthExpected,
    monthPlannedHours: monthAgg.planned,
    monthAttendanceHours: monthAgg.attendance,
    monthDeltaPlanned,
    monthDeltaAttendance,
    monthOvertimePlanned: monthDeltaPlanned > 0.05,
    cumulativeFrom,
    cumulativeTo: cumulativeFrom ? cumulativeTo : null,
    cumulativeExpectedHours: cumulativeExpected,
    cumulativePlannedHours: cumulativePlanned,
    cumulativeAttendanceHours: cumulativeAttendance,
    cumulativeDeltaPlanned,
    cumulativeDeltaAttendance,
    cumulativeOvertimePlanned: cumulativeDeltaPlanned > 0.05,
    incompleteAttendanceCount: monthAgg.incompleteCount,
    weeks,
  };
}

function minYmdLocal(a: string, b: string): string {
  return a <= b ? a : b;
}

function fallbackTermsFromStaff(staff: StaffRow): StaffContractTerms | null {
  const weekly = staff.targetWeeklyHours;
  if (weekly == null || weekly <= 0) return null;
  const isTerm =
    staff.contractType === "cdd" ||
    staff.contractType === "interim" ||
    staff.contractType === "stage" ||
    staff.contractType === "extra";
  return {
    contractId: "",
    contractKind: staff.contractType === "cdd" ? "cdd" : "cdi",
    status: "draft",
    staffMemberId: staff.id,
    displayName: staff.displayName,
    weeklyHours: weekly,
    startDate: staff.contractStartDate,
    endDate: staff.contractEndDate,
    isTermContract: isTerm,
  };
}

function mergeTermsWithProfile(
  hcrTerms: StaffContractTerms,
  profile: StaffContractTerms | null
): StaffContractTerms {
  return {
    ...hcrTerms,
    startDate: hcrTerms.startDate ?? profile?.startDate ?? null,
    endDate: hcrTerms.endDate ?? profile?.endDate ?? null,
  };
}

function resolveStaffTerms(
  staff: StaffRow,
  contracts: Awaited<ReturnType<typeof listHcrContracts>>
): StaffContractTerms | null {
  const profile = fallbackTermsFromStaff(staff);
  const hcr = pickStaffHcrContract(contracts, staff.id);
  if (hcr) {
    const hcrTerms = staffContractTermsFromRow(hcr);
    if (!hcrTerms) return profile;
    return mergeTermsWithProfile(hcrTerms, profile);
  }
  return profile;
}

export async function loadContractHoursReport(
  restaurantId: string,
  periodYm: string
): Promise<ContractHoursReport> {
  const monthStart = monthStartYmd(periodYm);
  const monthEnd = monthEndYmd(periodYm);
  const todayYmd = todayYmdParis();

  const [contracts, staffRes] = await Promise.all([
    listHcrContracts(restaurantId),
    supabaseServer
      .from("staff_members")
      .select(
        "id, display_name, role_label, contract_type, contract_start_date, contract_end_date, target_weekly_hours, active"
      )
      .eq("restaurant_id", restaurantId)
      .order("display_name"),
  ]);

  if (staffRes.error) throw new Error(staffRes.error.message);

  const staffList: StaffRow[] = (staffRes.data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const tw = row.target_weekly_hours;
    return {
      id: String(row.id),
      displayName: String(row.display_name ?? "").trim() || "Collaborateur",
      roleLabel: row.role_label ? String(row.role_label) : null,
      contractType: row.contract_type ? String(row.contract_type) : null,
      contractStartDate: toStaffYmd(row.contract_start_date),
      contractEndDate: toStaffYmd(row.contract_end_date),
      targetWeeklyHours:
        tw != null && Number.isFinite(Number(tw)) ? Number(tw) : null,
      active: Boolean(row.active),
    };
  });

  const staffById = new Map(staffList.map((s) => [s.id, s]));
  const tracked: { staff: StaffRow; terms: StaffContractTerms }[] = [];

  for (const staff of staffList) {
    if (!staff.active) continue;
    const terms = resolveStaffTerms(staff, contracts);
    if (!terms) continue;
    tracked.push({ staff, terms });
  }

  for (const contract of contracts) {
    if (!contract.staffMemberId || tracked.some((t) => t.staff.id === contract.staffMemberId)) {
      continue;
    }
    const linked = staffById.get(contract.staffMemberId);
    if (linked && !linked.active) continue;
    const terms = staffContractTermsFromRow(contract);
    if (!terms) continue;
    const staff =
      linked ??
      ({
        id: contract.staffMemberId,
        displayName: terms.displayName,
        roleLabel: null,
        contractType: contract.contractKind,
        contractStartDate: terms.startDate,
        contractEndDate: terms.endDate,
        targetWeeklyHours: terms.weeklyHours,
        active: true,
      } satisfies StaffRow);
    tracked.push({ staff, terms });
  }

  if (tracked.length === 0) {
    return {
      periodYm,
      periodLabel: formatPeriodMonthLabel(periodYm),
      generatedAt: new Date().toISOString(),
      rows: [],
    };
  }

  let rangeStart = monthStart;
  let rangeEnd = monthEnd;
  for (const { terms } of tracked) {
    const cumFrom =
      terms.startDate ?? (terms.isTermContract ? null : `${periodYm.split("-")[0]}-01-01`);
    const cumTo = terms.endDate ? minYmdLocal(terms.endDate, todayYmd) : todayYmd;
    if (cumFrom && cumFrom < rangeStart) rangeStart = cumFrom;
    if (cumTo > rangeEnd) rangeEnd = cumTo;
  }

  const rangeStartDate = new Date(`${rangeStart}T00:00:00+01:00`);
  const rangeEndDate = new Date(`${rangeEnd}T23:59:59+01:00`);
  rangeEndDate.setDate(rangeEndDate.getDate() + 1);

  const shifts = await listWorkShiftsInRange(
    restaurantId,
    rangeStartDate.toISOString(),
    rangeEndDate.toISOString()
  );

  const rows = tracked
    .map(({ staff, terms }) =>
      buildRowFromTerms({
        terms,
        staff,
        periodYm,
        todayYmd,
        monthStart,
        monthEnd,
        shifts,
      })
    )
    .filter((r): r is ContractHoursReportRow => r != null)
    .sort((a, b) => a.staffDisplayName.localeCompare(b.staffDisplayName, "fr"));

  return {
    periodYm,
    periodLabel: formatPeriodMonthLabel(periodYm),
    generatedAt: new Date().toISOString(),
    rows,
  };
}

/** Bornes ISO couvrant un mois (utilitaire export). */
export function reportMonthRangeIso(periodYm: string) {
  return monthRangeIso(periodYm);
}
