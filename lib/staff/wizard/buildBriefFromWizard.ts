import {
  parsePeakRows,
  resolvePeakBandsForDay,
  type PlanningDraftBriefPayload,
} from "@/lib/staff/planningDraftBrief";
import { PLANNING_DAY_KEYS, type PlanningDayKey } from "@/lib/staff/planningHoursTypes";
import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { addDays, parseISODateLocal } from "@/lib/staff/weekUtils";
import type { WizardData } from "./wizardDataTypes";

function toResolvedDay(d: WizardData, day: WizardData["establishment"]["days"][number]): WeekResolvedDay {
  const monday = parseISODateLocal(d.weekMondayYmd) ?? new Date();
  const idx = PLANNING_DAY_KEYS.indexOf(day.dayKey);
  return {
    ymd: day.ymd,
    dayKey: day.dayKey,
    date: addDays(monday, idx >= 0 ? idx : 0),
    openingBands: day.openingBands.value ?? [],
    staffExtraBands: day.staffExtraBands.value ?? [],
    staffTarget: day.staffTarget.value ?? null,
    exceptionLabel: null,
  };
}

function isWizardDayClosed(day: WizardData["establishment"]["days"][number]): boolean {
  return (day.openingBands.value?.length ?? 0) === 0;
}

/**
 * Mappe le modèle hydraté (WizardData) vers le payload attendu par
 * `applyPlanningDraftBriefAndGenerateAction` — avec effectifs, pointes et absences.
 */
export function buildBriefFromWizard(d: WizardData): PlanningDraftBriefPayload {
  const securityFloor = Math.max(2, Math.round(d.establishment.securityFloor.value ?? 2));

  const days = d.establishment.days.map((day) => {
    const isClosed = isWizardDayClosed(day);
    const target = isClosed ? null : Math.ceil(day.staffTarget.value ?? securityFloor);
    return {
      ymd: day.ymd,
      isClosed,
      openingBandsOverride: isClosed ? null : (day.openingBands.value ?? []),
      staffTargetOverride: isClosed ? null : target,
      label: null as string | null,
    };
  });

  const peakBandsByDay: Record<string, { start: string; end: string; staffCount: number }[]> = {};
  for (const day of d.establishment.days) {
    if (isWizardDayClosed(day)) continue;
    const wd = toResolvedDay(d, day);
    const target = day.staffTarget.value ?? securityFloor;

    const fromWizard = d.staffing.peakBandsByDay[day.dayKey]?.value ?? [];
    const peaks =
      fromWizard.length > 0
        ? fromWizard.map((e) => ({ start: e.start, end: e.end, staffCount: String(e.staffCount) }))
        : resolvePeakBandsForDay(wd, target, false);

    const parsed = parsePeakRows(peaks);
    if (parsed.length > 0) peakBandsByDay[day.ymd] = parsed;
  }

  // Absences : exclusion par jour (congé/indispo daté).
  const absentStaffIdsByYmd: Record<string, string[]> = {};
  const unavailableStaffIds: string[] = [];
  const openYmds = new Set(days.filter((x) => !x.isClosed).map((x) => x.ymd));

  for (const [staffId, entries] of Object.entries(d.constraints.leavesByStaffId)) {
    for (const e of entries) {
      (absentStaffIdsByYmd[e.ymd] ??= []).push(staffId);
    }
    const absentYmds = new Set(entries.map((e) => e.ymd));
    if (openYmds.size > 0 && [...openYmds].every((y) => absentYmds.has(y))) {
      unavailableStaffIds.push(staffId);
    }
  }

  const maxDailyHoursByStaffId: Record<string, number | null> = {};
  const contractWeeklyHoursByStaffId: Record<string, number> = {};
  const fixedRestDaysByStaffId: Partial<Record<string, PlanningDayKey[]>> = {};
  const weeklyRestDaysByStaffId: Record<string, number> = {};
  for (const m of d.team.members) {
    if (!m.active) continue;
    const md = m.maxDailyHours.value;
    maxDailyHoursByStaffId[m.staffMemberId] = md == null || md === 0 ? null : md;
    const h = m.contractWeeklyHours.value;
    if (h != null && h > 0) contractWeeklyHoursByStaffId[m.staffMemberId] = h;
    const rest = d.constraints.restRulesByStaffId[m.staffMemberId]?.fixedRestDays.value ?? [];
    if (rest.length > 0) fixedRestDaysByStaffId[m.staffMemberId] = rest;
    const weeklyRest = d.constraints.restRulesByStaffId[m.staffMemberId]?.weeklyRestDays.value ?? 2;
    weeklyRestDaysByStaffId[m.staffMemberId] = Math.min(7, Math.max(0, Math.round(weeklyRest)));
  }

  const weeklyTargets: Partial<Record<PlanningDayKey, number>> = {};
  for (const day of d.establishment.days) {
    if (isWizardDayClosed(day)) continue;
    const t = day.staffTarget.value;
    if (t != null && t > 0) weeklyTargets[day.dayKey] = t;
  }

  return {
    weekMondayYmd: d.weekMondayYmd,
    securityFloor,
    days,
    updateWeeklyTargets: Object.keys(weeklyTargets).length > 0,
    weeklyTargets,
    unavailableStaffIds,
    prioritizeRoleBalance: true,
    peakBandsByDay,
    allowWeeklyOvertime: { enabled: false, maxOvertimePercent: 0, staffIds: [] },
    applyCarryoverAfterGenerate: false,
    maxDailyHoursByStaffId,
    weeklyHoursBonusByStaffId: {},
    contractWeeklyHoursByStaffId,
    absentStaffIdsByYmd,
    fixedRestDaysByStaffId,
    weeklyRestDaysByStaffId,
  };
}
