import "server-only";

import {
  getRestaurantPlanningHourMaps,
  getRestaurantPlanningStaffTargetsWeekly,
  getRestaurantPlanningPeakBandsWeekly,
  getRestaurantPlanningSecurityFloor,
  listPlanningDayOverridesInRange,
  listStaffMembers,
} from "@/lib/staff/staffDb";
import { listStaffLeaveInRange } from "@/lib/staff/leaveDb";
import { resolveWeekPlanningDays } from "@/lib/staff/planningResolve";
import { detectCalendarForWeek } from "@/lib/franceCalendars/weekCalendar";
import type { PlanningDayKey, TimeBand } from "@/lib/staff/planningHoursTypes";
import type { PeakBandWeeklyEntry } from "@/lib/staff/planningPeakBands";
import { addDays, toISODateString } from "@/lib/staff/weekUtils";
import { resolvePeakBandsForDay, suggestStaffTargetFromDay } from "@/lib/staff/planningDraftBrief";
import { fieldComputed, fieldFromDb, fieldMissing } from "./wizardFieldTypes";
import { computeBaseNeedByDay } from "./predictiveNeed";
import type {
  EstablishmentDayFrame,
  HumanConstraintsData,
  LeaveEntry,
  RestRuleDraft,
  StaffingAdjustments,
  TeamMemberDraft,
  WizardData,
} from "./wizardDataTypes";

function parseMonday(weekMondayYmd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekMondayYmd.trim());
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Centralise la récupération + le formatage de TOUTES les données pré-existantes
 * pour une semaine, avec provenance par champ (db / computed / missing).
 * Appelée côté serveur (RSC / server action) ; le résultat alimente le wizard en props.
 */
export async function hydratePlanningWizard(
  restaurantId: string,
  weekMondayYmd: string,
  ctx: { templateSlug: string | null; schoolZone: "A" | "B" | "C" | null }
): Promise<WizardData> {
  const monday = parseMonday(weekMondayYmd);
  const fromYmd = toISODateString(monday);
  const toExclusive = toISODateString(addDays(monday, 7));

  const [hourMaps, weeklyStaff, peakWeekly, securityFloor, overrides, staff, leaves] = await Promise.all([
    getRestaurantPlanningHourMaps(restaurantId),
    getRestaurantPlanningStaffTargetsWeekly(restaurantId),
    getRestaurantPlanningPeakBandsWeekly(restaurantId),
    getRestaurantPlanningSecurityFloor(restaurantId),
    listPlanningDayOverridesInRange(restaurantId, fromYmd, toExclusive),
    listStaffMembers(restaurantId, true),
    listStaffLeaveInRange(restaurantId, fromYmd, toExclusive),
  ]);

  const resolved = resolveWeekPlanningDays(
    monday,
    hourMaps.opening,
    hourMaps.staffExtra,
    weeklyStaff,
    overrides
  );

  // ── Étape 1 : cadre établissement ──────────────────────────────────────────
  const days: EstablishmentDayFrame[] = resolved.map((wd) => {
    const isClosed =
      wd.openingBands.length === 0 && (wd.staffExtraBands?.length ?? 0) === 0;
    const suggested = isClosed ? null : suggestStaffTargetFromDay(wd);
    const base = wd.staffTarget ?? suggested;
    const target = isClosed
      ? null
      : Math.max(securityFloor, base != null && base > 0 ? Math.ceil(base) : securityFloor);
    return {
      dayKey: wd.dayKey,
      ymd: wd.ymd,
      isClosed,
      openingBands: fieldFromDb<TimeBand[]>(wd.openingBands),
      staffExtraBands: fieldFromDb<TimeBand[]>(wd.staffExtraBands),
      staffTarget: target != null ? fieldComputed<number>(target) : fieldMissing<number>(),
    };
  });

  const detectedCalendar = detectCalendarForWeek(weekMondayYmd, ctx.schoolZone);

  const establishment = {
    establishmentType: ctx.templateSlug
      ? fieldFromDb<string>(ctx.templateSlug)
      : fieldComputed<string>("other"),
    days,
    securityFloor: fieldFromDb<number>(securityFloor, { kind: "restaurant.securityFloor" }),
    detectedCalendar,
  };

  // ── Étape 2 : équipe & contrats ────────────────────────────────────────────
  const members: TeamMemberDraft[] = staff.map((s) => ({
    staffMemberId: s.id,
    displayName: s.display_name,
    active: s.active,
    role: s.role_label
      ? fieldFromDb<string>(s.role_label, { kind: "staff.role", staffMemberId: s.id })
      : fieldMissing<string>({ kind: "staff.role", staffMemberId: s.id }),
    contractWeeklyHours:
      s.target_weekly_hours != null
        ? fieldFromDb<number>(s.target_weekly_hours, {
            kind: "staff.contractWeeklyHours",
            staffMemberId: s.id,
          }, true)
        : fieldMissing<number>({ kind: "staff.contractWeeklyHours", staffMemberId: s.id }),
    maxDailyHours:
      s.max_daily_hours != null
        ? fieldFromDb<number>(s.max_daily_hours, { kind: "staff.maxDailyHours", staffMemberId: s.id })
        : fieldComputed<number>(0, { kind: "staff.maxDailyHours", staffMemberId: s.id }),
    defaultShiftPattern:
      s.planning_default_shift_pattern != null
        ? fieldFromDb(s.planning_default_shift_pattern, {
            kind: "staff.defaultShiftPattern",
            staffMemberId: s.id,
          })
        : fieldMissing({ kind: "staff.defaultShiftPattern", staffMemberId: s.id }),
  }));

  // ── Étape 3 : contraintes humaines ─────────────────────────────────────────
  const leavesByStaffId: Record<string, LeaveEntry[]> = {};
  for (const lv of leaves) {
    (leavesByStaffId[lv.staff_member_id] ??= []).push({
      ymd: lv.day,
      kind: lv.kind,
      label: lv.label ?? (lv.kind === "leave" ? "Congé validé" : "Indisponible"),
    });
  }

  const restRulesByStaffId: Record<string, RestRuleDraft> = {};
  for (const s of staff) {
    restRulesByStaffId[s.id] = {
      staffMemberId: s.id,
      fixedRestDays: fieldFromDb<PlanningDayKey[]>(s.planning_fixed_rest_days, {
        kind: "staff.restRule",
        staffMemberId: s.id,
      }),
      weeklyRestDays: fieldFromDb<number>(s.planning_weekly_rest_days, {
        kind: "staff.restRule",
        staffMemberId: s.id,
      }),
      requireConsecutive: fieldFromDb<boolean>(s.planning_require_consecutive_rest, {
        kind: "staff.restRule",
        staffMemberId: s.id,
      }),
    };
  }

  const constraints: HumanConstraintsData = { leavesByStaffId, restRulesByStaffId };

  // ── Étape 4 : besoin staff prédictif ───────────────────────────────────────
  const peakBandsByDay: Partial<Record<PlanningDayKey, ReturnType<typeof fieldFromDb<PeakBandWeeklyEntry[]>>>> = {};
  const openingByDay: Partial<Record<PlanningDayKey, TimeBand[]>> = {};
  const peaksRawByDay: Partial<Record<PlanningDayKey, PeakBandWeeklyEntry[]>> = {};
  for (const wd of resolved) {
    const dayFrame = days.find((d) => d.ymd === wd.ymd);
    const isClosed = dayFrame?.isClosed ?? false;
    openingByDay[wd.dayKey] = wd.openingBands;
    const modelPeaks = peakWeekly[wd.dayKey] ?? [];
    const target = dayFrame?.staffTarget.value ?? securityFloor;
    const suggested =
      modelPeaks.length > 0
        ? modelPeaks
        : isClosed
          ? []
          : resolvePeakBandsForDay(wd, target, false).map((p) => ({
              start: p.start,
              end: p.end,
              staffCount: Math.ceil(Number(p.staffCount) || target),
            }));
    peaksRawByDay[wd.dayKey] = suggested;
    peakBandsByDay[wd.dayKey] =
      modelPeaks.length > 0
        ? fieldFromDb<PeakBandWeeklyEntry[]>(modelPeaks, { kind: "restaurant.peakBandsWeekly" })
        : suggested.length > 0
          ? fieldComputed<PeakBandWeeklyEntry[]>(suggested, { kind: "restaurant.peakBandsWeekly" })
          : fieldComputed<PeakBandWeeklyEntry[]>([], { kind: "restaurant.peakBandsWeekly" });
  }

  const adjustments: StaffingAdjustments = { heatwave: false, highTraffic: false };
  const baseNeedByDay = computeBaseNeedByDay(openingByDay, securityFloor, peaksRawByDay, adjustments);

  return {
    restaurantId,
    weekMondayYmd,
    establishment,
    team: { members },
    constraints,
    staffing: { peakBandsByDay, adjustments, baseNeedByDay },
  };
}
