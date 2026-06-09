import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { minutesFromMidnight, type TimeBand } from "@/lib/staff/planningHoursTypes";
import type { PlanningPeakBandInput, PlanningSimulationOptions } from "@/lib/staff/planningSimulationOptions";
import { intersectTimeBands, mergeTimeBands, mergedStaffWorkBands } from "@/lib/staff/staffWorkWindows";
import type { StaffMember } from "@/lib/staff/types";

export type GeneratedSimulationShift = {
  staff_member_id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number | null;
  notes: string | null;
};

export type PlanningGenerationShortfall = {
  ymd: string;
  kind: "service" | "peak" | "empty_day";
  label: string;
  wanted: number;
  placed: number;
  missing: number;
  teamGap: number;
};

export type PlanningGenerationResult = {
  shifts: GeneratedSimulationShift[];
  shortfalls: PlanningGenerationShortfall[];
  summaryFr: string | null;
};

type Ctx = {
  active: StaffMember[];
  weeklyBudget: Map<string, number | null>;
  usedNet: Map<string, number>;
  dailyUsedNet: Map<string, number>;
  out: GeneratedSimulationShift[];
  options: PlanningSimulationOptions | undefined;
};

const SLOT_STEP = 30;
const MAX_GENERATED_SHIFT_GROSS_MINUTES = 10 * 60;

// ─── Utilitaires temps / pauses ───────────────────────────────────────────────

function bandDuration(b: TimeBand): number {
  const a = minutesFromMidnight(b.start);
  const e = minutesFromMidnight(b.end);
  if (a == null || e == null || e <= a) return 0;
  return e - a;
}

function breakFor(durM: number): number | null {
  if (durM > 360) return 30;
  if (durM > 240) return 15;
  return null;
}

function netMin(durM: number): number {
  return Math.max(0, durM - (breakFor(durM) ?? 0));
}

function grossForNet(netM: number): number {
  for (let g = netM; g <= netM + 45; g++) {
    if (netMin(g) >= netM) return g;
  }
  return netM;
}

function hhmmFromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function startOfDay(day: Date, hhmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return new Date(day);
  const d = new Date(day);
  d.setHours(+m[1], +m[2], 0, 0);
  return d;
}

function shiftYmdLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftSpanLocal(isoStart: string, isoEnd: string): { ss: number; se: number } | null {
  const st = new Date(isoStart);
  const en = new Date(isoEnd);
  const ss = st.getHours() * 60 + st.getMinutes();
  const se = en.getHours() * 60 + en.getMinutes();
  if (se <= ss) return null;
  return { ss, se };
}

function bandTimeSlots(band: TimeBand): number[] {
  const startM = minutesFromMidnight(band.start);
  const endM = minutesFromMidnight(band.end);
  if (startM == null || endM == null || endM <= startM) return [];
  const slots: number[] = [];
  for (let m = startM; m + SLOT_STEP <= endM; m += SLOT_STEP) slots.push(m);
  return slots.length > 0 ? slots : [startM];
}

function overlapsBand(band: TimeBand, eff: TimeBand[]): TimeBand[] {
  return intersectTimeBands([band], eff).filter((b) => bandDuration(b) >= 15);
}

function roleFamily(m: StaffMember): number {
  const r = (m.role_label ?? "").toLowerCase();
  if (/g[eé]rant|manager/.test(r)) return 0;
  if (/chef|cuisine|cuisinier|commis/.test(r)) return 1;
  if (/serveur|serveuse|salle|h[oô]te/.test(r)) return 2;
  return 3;
}

function buildWeeklyBudgetMinutes(m: StaffMember, options?: PlanningSimulationOptions): number | null {
  const base =
    m.target_weekly_hours != null && m.target_weekly_hours > 0
      ? Math.round(m.target_weekly_hours * 60)
      : null;
  if (base == null) return null;

  let bud = base;
  const ot = options?.allowWeeklyOvertime;
  if (ot?.enabled && (ot.staffIds.length === 0 || ot.staffIds.includes(m.id))) {
    bud += Math.round(base * (Math.max(0, ot.maxOvertimePercent) / 100));
  }
  const bonusH = options?.weeklyHoursBonusByStaffId?.[m.id];
  if (bonusH != null && Number.isFinite(bonusH) && bonusH > 0) {
    bud += Math.round(bonusH * 60);
  }
  return bud;
}

function resolveMaxDailyHours(m: StaffMember, options?: PlanningSimulationOptions): number | null {
  if (options?.maxDailyHoursByStaffId && m.id in options.maxDailyHoursByStaffId) {
    const v = options.maxDailyHoursByStaffId[m.id];
    if (v == null || !Number.isFinite(v) || v <= 0) return null;
    return v;
  }
  const md = m.max_daily_hours;
  if (md == null || !Number.isFinite(md) || md <= 0) return null;
  return md;
}

function dailyKey(staffId: string, ymd: string): string {
  return `${staffId}|${ymd}`;
}

function resolveDayTarget(wd: WeekResolvedDay, activeCount: number): number {
  const t =
    wd.staffTarget != null && wd.staffTarget > 0 ? Math.ceil(wd.staffTarget) : 2;
  return Math.min(Math.max(1, t), activeCount);
}

function resolveSecurityFloor(ctx: Ctx): number {
  const floor = ctx.options?.securityFloor;
  if (floor != null && Number.isFinite(floor) && floor > 0) {
    return Math.min(Math.ceil(floor), ctx.active.length);
  }
  return Math.min(1, ctx.active.length);
}

function isAbsentOnDay(staffId: string, ymd: string, ctx: Ctx): boolean {
  const absent = ctx.options?.absentStaffIdsByYmd?.[ymd];
  return absent != null && absent.includes(staffId);
}

function isUnavailableOnDay(staffId: string, wd: WeekResolvedDay, ctx: Ctx): boolean {
  if (isAbsentOnDay(staffId, wd.ymd, ctx)) return true;
  return ctx.options?.fixedRestDaysByStaffId?.[staffId]?.includes(wd.dayKey) ?? false;
}

function staffCanWorkUntil(m: StaffMember, wd: WeekResolvedDay, endM: number): boolean {
  return mergedStaffWorkBands(m, wd).some((b) => {
    const e = minutesFromMidnight(b.end);
    return e != null && e >= endM;
  });
}

function remainingWeeklyNet(m: StaffMember, ctx: Ctx): number {
  const bud = ctx.weeklyBudget.get(m.id);
  if (bud == null) return 999999;
  return Math.max(0, bud - (ctx.usedNet.get(m.id) ?? 0));
}

function remainingDailyNet(m: StaffMember, ymd: string, ctx: Ctx): number | null {
  const maxH = resolveMaxDailyHours(m, ctx.options);
  if (maxH == null) return null;
  return Math.max(0, Math.round(maxH * 60) - (ctx.dailyUsedNet.get(dailyKey(m.id, ymd)) ?? 0));
}

function contractPct(m: StaffMember, ctx: Ctx): number {
  const bud = ctx.weeklyBudget.get(m.id);
  if (!bud) return 0;
  return (ctx.usedNet.get(m.id) ?? 0) / bud;
}

function addDailyUsed(staffId: string, ymd: string, minutes: number, ctx: Ctx): void {
  ctx.dailyUsedNet.set(dailyKey(staffId, ymd), (ctx.dailyUsedNet.get(dailyKey(staffId, ymd)) ?? 0) + minutes);
}

// ─── Mesure de couverture ─────────────────────────────────────────────────────

function countStaffAtMinute(shifts: GeneratedSimulationShift[], ymd: string, minute: number): number {
  const ids = new Set<string>();
  for (const s of shifts) {
    if (shiftYmdLocal(s.starts_at) !== ymd) continue;
    const span = shiftSpanLocal(s.starts_at, s.ends_at);
    if (!span) continue;
    if (span.ss <= minute && span.se >= minute + SLOT_STEP) ids.add(s.staff_member_id);
  }
  return ids.size;
}

function minCoverageInBand(shifts: GeneratedSimulationShift[], ymd: string, band: TimeBand): number {
  const slots = bandTimeSlots(band);
  if (slots.length === 0) return 0;
  return Math.min(...slots.map((slot) => countStaffAtMinute(shifts, ymd, slot)));
}

function worstCoverageSlot(shifts: GeneratedSimulationShift[], ymd: string, band: TimeBand): number {
  const slots = bandTimeSlots(band);
  let worst = slots[0] ?? minutesFromMidnight(band.start) ?? 0;
  let minC = Infinity;
  for (const slot of slots) {
    const c = countStaffAtMinute(shifts, ymd, slot);
    if (c < minC) {
      minC = c;
      worst = slot;
    }
  }
  return worst;
}

function staffCoversMinute(
  staffId: string,
  shifts: GeneratedSimulationShift[],
  ymd: string,
  minute: number
): boolean {
  for (const s of shifts) {
    if (s.staff_member_id !== staffId || shiftYmdLocal(s.starts_at) !== ymd) continue;
    const span = shiftSpanLocal(s.starts_at, s.ends_at);
    if (!span) continue;
    if (span.ss <= minute && span.se >= minute + SLOT_STEP) return true;
  }
  return false;
}

function shiftOverlapsWindow(
  staffId: string,
  ymd: string,
  startM: number,
  endM: number,
  shifts: GeneratedSimulationShift[]
): boolean {
  for (const s of shifts) {
    if (s.staff_member_id !== staffId || shiftYmdLocal(s.starts_at) !== ymd) continue;
    const span = shiftSpanLocal(s.starts_at, s.ends_at);
    if (!span) continue;
    if (span.ss < endM && span.se > startM) return true;
  }
  return false;
}

// ─── Placement ────────────────────────────────────────────────────────────────

function commitShift(
  m: StaffMember,
  wd: WeekResolvedDay,
  start: Date,
  end: Date,
  ctx: Ctx,
  note: string
): boolean {
  const durM = Math.round((end.getTime() - start.getTime()) / 60000);
  if (durM < 15) return false;
  if (wouldExceedWeeklyRestDays(m, wd, ctx)) return false;

  const finalNet = netMin(durM);
  if (finalNet > remainingWeeklyNet(m, ctx)) return false;

  const dailyRem = remainingDailyNet(m, wd.ymd, ctx);
  if (dailyRem != null && finalNet > dailyRem) return false;

  ctx.usedNet.set(m.id, (ctx.usedNet.get(m.id) ?? 0) + finalNet);
  addDailyUsed(m.id, wd.ymd, finalNet, ctx);
  ctx.out.push({
    staff_member_id: m.id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    break_minutes: breakFor(durM),
    notes: note,
  });
  return true;
}

/** Pose un shift [startM, endM] dans la disponibilité du collaborateur. */
function placeWindowShift(
  m: StaffMember,
  wd: WeekResolvedDay,
  startM: number,
  endM: number,
  ctx: Ctx,
  note: string
): boolean {
  if (endM <= startM) return false;
  if (shiftOverlapsWindow(m.id, wd.ymd, startM, endM, ctx.out)) return false;

  const window: TimeBand = { start: hhmmFromMinutes(startM), end: hhmmFromMinutes(endM) };
  const eff = mergedStaffWorkBands(m, wd);
  const segs = mergeTimeBands(overlapsBand(window, eff));
  if (segs.length === 0) return false;

  const seg = segs.sort((a, b) => bandDuration(b) - bandDuration(a))[0]!;
  const segStart = minutesFromMidnight(seg.start)!;
  const segEnd = minutesFromMidnight(seg.end)!;
  if (segEnd - segStart < 15) return false;

  const weeklyRem = remainingWeeklyNet(m, ctx);
  let gross = segEnd - segStart;
  gross = Math.min(gross, grossForNet(weeklyRem));
  const dailyRem = remainingDailyNet(m, wd.ymd, ctx);
  if (dailyRem != null) gross = Math.min(gross, grossForNet(dailyRem));
  if (gross < 15) return false;

  const useEnd = Math.min(segEnd, segStart + gross);
  return commitShift(
    m,
    wd,
    startOfDay(wd.date, hhmmFromMinutes(segStart)),
    startOfDay(wd.date, hhmmFromMinutes(useEnd)),
    ctx,
    note
  );
}

function placeShiftAroundSlot(
  m: StaffMember,
  wd: WeekResolvedDay,
  band: TimeBand,
  slot: number,
  ctx: Ctx,
  note: string
): boolean {
  const bandStart = minutesFromMidnight(band.start);
  const bandEnd = minutesFromMidnight(band.end);
  if (bandStart == null || bandEnd == null || bandEnd <= bandStart) return false;
  if (shiftOverlapsWindow(m.id, wd.ymd, bandStart, bandEnd, ctx.out)) return false;

  const segs = mergeTimeBands(overlapsBand(band, mergedStaffWorkBands(m, wd))).filter((seg) => {
    const start = minutesFromMidnight(seg.start);
    const end = minutesFromMidnight(seg.end);
    return start != null && end != null && start <= slot && end >= slot + SLOT_STEP;
  });
  if (segs.length === 0) return false;

  const seg = segs.sort((a, b) => bandDuration(b) - bandDuration(a))[0]!;
  const segStart = minutesFromMidnight(seg.start)!;
  const segEnd = minutesFromMidnight(seg.end)!;
  const span = segEnd - segStart;
  if (span < 15) return false;

  const weeklyRem = remainingWeeklyNet(m, ctx);
  const dailyRem = remainingDailyNet(m, wd.ymd, ctx);
  const maxNet = dailyRem == null ? weeklyRem : Math.min(weeklyRem, dailyRem);
  const desiredGross = Math.min(span, MAX_GENERATED_SHIFT_GROSS_MINUTES, grossForNet(maxNet));
  if (desiredGross < SLOT_STEP) return false;

  const isClosingSlot = slot + SLOT_STEP >= bandEnd;
  let startM: number;
  let endM: number;
  if (isClosingSlot) {
    endM = segEnd;
    startM = Math.max(segStart, endM - desiredGross);
  } else if (slot <= bandStart) {
    startM = segStart;
    endM = Math.min(segEnd, startM + desiredGross);
  } else {
    startM = Math.max(segStart, Math.min(slot - Math.floor(desiredGross / 2), segEnd - desiredGross));
    endM = Math.min(segEnd, startM + desiredGross);
  }

  if (startM > slot || endM < slot + SLOT_STEP) {
    startM = Math.max(segStart, Math.min(slot, segEnd - desiredGross));
    endM = Math.min(segEnd, startM + desiredGross);
  }

  return commitShift(
    m,
    wd,
    startOfDay(wd.date, hhmmFromMinutes(startM)),
    startOfDay(wd.date, hhmmFromMinutes(endM)),
    ctx,
    note
  );
}

/** Couvre toute une plage de service (ouverture → fermeture). */
function placeFullBandShift(
  m: StaffMember,
  wd: WeekResolvedDay,
  band: TimeBand,
  ctx: Ctx,
  note: string
): boolean {
  const startM = minutesFromMidnight(band.start);
  const endM = minutesFromMidnight(band.end);
  if (startM == null || endM == null) return false;
  return placeWindowShift(m, wd, startM, endM, ctx, note);
}

function daysWorkedThisWeek(staffId: string, ctx: Ctx): number {
  const days = new Set<string>();
  for (const s of ctx.out) {
    if (s.staff_member_id === staffId) days.add(shiftYmdLocal(s.starts_at));
  }
  return days.size;
}

function maxWorkedDaysThisWeek(m: StaffMember, ctx: Ctx): number {
  const fromOptions = ctx.options?.weeklyRestDaysByStaffId?.[m.id];
  const restDays =
    fromOptions != null && Number.isFinite(fromOptions)
      ? Math.min(7, Math.max(0, Math.round(fromOptions)))
      : Math.min(7, Math.max(0, Math.round(m.planning_weekly_rest_days ?? 2)));
  return Math.max(0, 7 - restDays);
}

function remainingWorkDaysAllowance(m: StaffMember, ctx: Ctx): number {
  return Math.max(0, maxWorkedDaysThisWeek(m, ctx) - daysWorkedThisWeek(m.id, ctx));
}

function wouldExceedWeeklyRestDays(m: StaffMember, wd: WeekResolvedDay, ctx: Ctx): boolean {
  if (staffOnDay(ctx, wd.ymd).some((x) => x.id === m.id)) return false;
  return daysWorkedThisWeek(m.id, ctx) >= maxWorkedDaysThisWeek(m, ctx);
}

function sortCandidates(
  ctx: Ctx,
  wd: WeekResolvedDay,
  band: TimeBand,
  slot: number,
  alreadyOnDay: StaffMember[]
): StaffMember[] {
  function roleScore(m: StaffMember): number {
    if (!ctx.options?.prioritizeRoleBalance) return 0;
    const fam = roleFamily(m);
    const total = ctx.active.filter((x) => roleFamily(x) === fam).length;
    const done = alreadyOnDay.filter((x) => roleFamily(x) === fam).length;
    const expected = alreadyOnDay.length > 0 ? alreadyOnDay.length * (total / ctx.active.length) : 0;
    return Math.max(0, expected - done);
  }

  return ctx.active
    .filter((m) => {
      if (isUnavailableOnDay(m.id, wd, ctx)) return false;
      if (wouldExceedWeeklyRestDays(m, wd, ctx)) return false;
      if (staffCoversMinute(m.id, ctx.out, wd.ymd, slot)) return false;
      if (remainingWeeklyNet(m, ctx) < 30) return false;
      const dailyRem = remainingDailyNet(m, wd.ymd, ctx);
      if (dailyRem != null && dailyRem < 30) return false;
      return overlapsBand(band, mergedStaffWorkBands(m, wd)).length > 0;
    })
    .sort((a, b) => {
      const dw = daysWorkedThisWeek(a.id, ctx) - daysWorkedThisWeek(b.id, ctx);
      if (dw !== 0) return dw;
      const allowance = remainingWorkDaysAllowance(b, ctx) - remainingWorkDaysAllowance(a, ctx);
      if (allowance !== 0) return allowance;
      const rs = roleScore(b) - roleScore(a);
      if (Math.abs(rs) > 0.01) return rs;
      return contractPct(a, ctx) - contractPct(b, ctx);
    });
}

function staffOnDay(ctx: Ctx, ymd: string): StaffMember[] {
  const ids = new Set(
    ctx.out.filter((s) => shiftYmdLocal(s.starts_at) === ymd).map((s) => s.staff_member_id)
  );
  return ctx.active.filter((m) => ids.has(m.id));
}

/** Couvre une plage avec `target` personnes simultanées sur tous les créneaux. */
function ensureBandCoverage(wd: WeekResolvedDay, band: TimeBand, target: number, ctx: Ctx, note: string): void {
  for (let attempt = 0; attempt < ctx.active.length * 3; attempt++) {
    if (minCoverageInBand(ctx.out, wd.ymd, band) >= target) return;

    const slot = worstCoverageSlot(ctx.out, wd.ymd, band);
    const onDay = staffOnDay(ctx, wd.ymd);
    const candidates = sortCandidates(ctx, wd, band, slot, onDay);
    if (candidates.length === 0) return;

    if (!placeShiftAroundSlot(candidates[0]!, wd, band, slot, ctx, note)) return;
  }
}

function ensurePeakCoverage(wd: WeekResolvedDay, peak: PlanningPeakBandInput, ctx: Ctx): void {
  const band: TimeBand = { start: peak.start, end: peak.end };
  const target = Math.min(Math.ceil(peak.staffCount), ctx.active.length);
  const peakStart = minutesFromMidnight(peak.start);
  const peakEnd = minutesFromMidnight(peak.end);
  if (peakStart == null || peakEnd == null || peakEnd <= peakStart) return;
  const insideOpening = wd.openingBands.some((opening) => {
    const openStart = minutesFromMidnight(opening.start);
    const openEnd = minutesFromMidnight(opening.end);
    return openStart != null && openEnd != null && peakStart >= openStart && peakEnd <= openEnd;
  });
  if (!insideOpening) return;

  for (let attempt = 0; attempt < ctx.active.length * 3; attempt++) {
    if (minCoverageInBand(ctx.out, wd.ymd, band) >= target) return;

    const slot = worstCoverageSlot(ctx.out, wd.ymd, band);
    const onDay = staffOnDay(ctx, wd.ymd);
    const candidates = sortCandidates(ctx, wd, band, slot, onDay);
    if (candidates.length === 0) return;

    if (!placeWindowShift(candidates[0]!, wd, peakStart, peakEnd, ctx, `Pointe · ${peak.start}–${peak.end}`)) {
      if (!placeFullBandShift(candidates[0]!, wd, band, ctx, `Pointe · ${peak.start}–${peak.end}`)) return;
    }
  }
}

/** Renforce la dernière demi-heure avant fermeture (souvent sous-couverte). */
function ensureClosingCoverage(
  wd: WeekResolvedDay,
  band: TimeBand,
  target: number,
  ctx: Ctx
): void {
  const endM = minutesFromMidnight(band.end);
  const startM = minutesFromMidnight(band.start);
  if (endM == null || startM == null || endM <= startM) return;
  const closeSlot = endM - SLOT_STEP;
  if (closeSlot < startM) return;

  for (let attempt = 0; attempt < ctx.active.length * 3; attempt++) {
    if (countStaffAtMinute(ctx.out, wd.ymd, closeSlot) >= target) return;

    const candidates = ctx.active
      .filter((m) => !isUnavailableOnDay(m.id, wd, ctx))
      .filter((m) => staffCanWorkUntil(m, wd, endM))
      .filter((m) => !staffCoversMinute(m.id, ctx.out, wd.ymd, closeSlot))
      .filter((m) => remainingWeeklyNet(m, ctx) >= 30)
      .filter((m) => {
        const dailyRem = remainingDailyNet(m, wd.ymd, ctx);
        return dailyRem == null || dailyRem >= 30;
      })
      .sort((a, b) => contractPct(a, ctx) - contractPct(b, ctx));

    if (candidates.length === 0) return;

    if (!placeShiftAroundSlot(candidates[0]!, wd, band, closeSlot, ctx, `Fermeture · ${band.end}`)) return;
  }
}

function leastCoveredOpeningSlot(wd: WeekResolvedDay, ctx: Ctx): { band: TimeBand; slot: number } | null {
  let best: { band: TimeBand; slot: number; coverage: number } | null = null;
  for (const band of wd.openingBands) {
    for (const slot of bandTimeSlots(band)) {
      const coverage = countStaffAtMinute(ctx.out, wd.ymd, slot);
      if (!best || coverage < best.coverage || (coverage === best.coverage && slot > best.slot)) {
        best = { band, slot, coverage };
      }
    }
  }
  return best ? { band: best.band, slot: best.slot } : null;
}

function ensureDayRosterSize(wd: WeekResolvedDay, ctx: Ctx): void {
  const target = resolveDayTarget(wd, ctx.active.length);
  for (let attempt = 0; attempt < ctx.active.length * 2; attempt++) {
    if (staffOnDay(ctx, wd.ymd).length >= target) return;
    const gap = leastCoveredOpeningSlot(wd, ctx);
    if (!gap) return;
    const already = new Set(staffOnDay(ctx, wd.ymd).map((m) => m.id));
    const candidates = sortCandidates(ctx, wd, gap.band, gap.slot, staffOnDay(ctx, wd.ymd))
      .filter((m) => !already.has(m.id));
    if (candidates.length === 0) return;
    if (!placeShiftAroundSlot(candidates[0]!, wd, gap.band, gap.slot, ctx, "Service · renfort journée")) return;
  }
}

function coverServiceBandsFairly(openDays: WeekResolvedDay[], ctx: Ctx): void {
  const floor = resolveSecurityFloor(ctx);

  for (let level = 1; level <= floor; level++) {
    for (const wd of openDays) {
      for (const band of wd.openingBands) {
        ensureBandCoverage(wd, band, level, ctx, `Service · ${band.start}–${band.end}`);
        ensureClosingCoverage(wd, band, level, ctx);
      }
    }
  }

  for (const wd of openDays) {
    ensureDayRosterSize(wd, ctx);
  }
}

function coverPeakBandsFairly(openDays: WeekResolvedDay[], ctx: Ctx): void {
  const peaksByDay = new Map(openDays.map((wd) => [wd.ymd, ctx.options?.peakBandsByDay?.[wd.ymd] ?? []]));
  const maxTarget = Math.max(
    0,
    ...[...peaksByDay.values()].flat().map((p) => Math.min(Math.ceil(p.staffCount), ctx.active.length))
  );

  for (let level = 1; level <= maxTarget; level++) {
    for (const wd of openDays) {
      const peaks = peaksByDay.get(wd.ymd) ?? [];
      for (const peak of peaks) {
        if (Math.min(Math.ceil(peak.staffCount), ctx.active.length) < level) continue;
        ensurePeakCoverage(wd, { ...peak, staffCount: level }, ctx);
      }
    }
  }
}

function requiredCoverageForBand(wd: WeekResolvedDay, band: TimeBand, ctx: Ctx): number {
  void wd;
  void band;
  return resolveSecurityFloor(ctx);
}


function personNetOnDay(staffId: string, ymd: string, ctx: Ctx): number {
  let net = 0;
  for (const s of ctx.out) {
    if (s.staff_member_id !== staffId || shiftYmdLocal(s.starts_at) !== ymd) continue;
    const dur = Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000);
    net += netMin(dur);
  }
  return net;
}

/** Ajoute midi ou soir si la personne n’a qu’un service ce jour-là (sans sur-staffer). */
function fillSecondBandSameDay(ctx: Ctx, openDays: WeekResolvedDay[]): void {
  for (let round = 0; round < 40; round++) {
    const needy = ctx.active
      .filter((m) => remainingWeeklyNet(m, ctx) >= 60)
      .sort((a, b) => contractPct(a, ctx) - contractPct(b, ctx));
    if (needy.length === 0) break;

    let progress = false;
    for (const m of needy) {
      for (const wd of openDays) {
        if (isUnavailableOnDay(m.id, wd, ctx)) continue;
        const myShifts = ctx.out.filter(
          (s) => s.staff_member_id === m.id && shiftYmdLocal(s.starts_at) === wd.ymd
        );
        if (myShifts.length === 0) continue;

        for (const band of wd.openingBands) {
          const req = requiredCoverageForBand(wd, band, ctx);
          if (minCoverageInBand(ctx.out, wd.ymd, band) >= req) continue;
          const startM = minutesFromMidnight(band.start)!;
          const endM = minutesFromMidnight(band.end)!;
          if (shiftOverlapsWindow(m.id, wd.ymd, startM, endM, ctx.out)) continue;
          const slot = worstCoverageSlot(ctx.out, wd.ymd, band);
          if (placeShiftAroundSlot(m, wd, band, slot, ctx, "Complément contrat")) {
            progress = true;
            break;
          }
        }
        if (progress) break;
      }
      if (progress) break;
    }
    if (!progress) break;
  }
}

function distributionPriority(wd: WeekResolvedDay): number {
  if (wd.dayKey === "mon") return 1;
  if (wd.dayKey === "tue") return 2;
  if (wd.dayKey === "wed") return 3;
  if (wd.dayKey === "thu") return 4;
  if (wd.dayKey === "fri") return 5;
  if (wd.dayKey === "sun") return 6;
  if (wd.dayKey === "sat") return 7;
  return 8;
}

/** Complète les heures de contrat : d’abord hors-client, puis plages encore sous l’effectif. */
function fillContractHours(ctx: Ctx, openDays: WeekResolvedDay[]): void {
  for (let round = 0; round < 120; round++) {
    const needy = ctx.active
      .filter((m) => remainingWeeklyNet(m, ctx) >= 60)
      .sort((a, b) => contractPct(a, ctx) - contractPct(b, ctx));

    if (needy.length === 0) break;

    let progress = false;

    for (const m of needy) {
      const days = [...openDays].sort((a, b) => {
        const diff = personNetOnDay(m.id, a.ymd, ctx) - personNetOnDay(m.id, b.ymd, ctx);
        if (diff !== 0) return diff;
        return distributionPriority(a) - distributionPriority(b);
      });

      for (const wd of days) {
        if (isUnavailableOnDay(m.id, wd, ctx)) continue;
        const openingBands = wd.openingBands;

        const bandGroups: TimeBand[][] = [openingBands];

        for (const bands of bandGroups) {
          for (const band of bands) {
            const startM = minutesFromMidnight(band.start);
            const endM = minutesFromMidnight(band.end);
            if (startM == null || endM == null) continue;
            if (shiftOverlapsWindow(m.id, wd.ymd, startM, endM, ctx.out)) continue;
            if (overlapsBand(band, mergedStaffWorkBands(m, wd)).length === 0) continue;

            const slot = worstCoverageSlot(ctx.out, wd.ymd, band);
            if (placeShiftAroundSlot(m, wd, band, slot, ctx, "Complément contrat")) {
              progress = true;
              break;
            }
          }
          if (progress) break;
        }
        if (progress) break;
      }
      if (progress) break;
    }

    if (!progress) break;
  }
}

// ─── Rapport ──────────────────────────────────────────────────────────────────

function dateLabelFr(wd: WeekResolvedDay): string {
  return wd.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function computeShortfalls(openDays: WeekResolvedDay[], ctx: Ctx): PlanningGenerationShortfall[] {
  const shortfalls: PlanningGenerationShortfall[] = [];

  for (const wd of openDays) {
    const baseTarget = resolveDayTarget(wd, ctx.active.length);
    const label = dateLabelFr(wd);
    const peaks = ctx.options?.peakBandsByDay?.[wd.ymd] ?? [];

    const distinct = new Set(
      ctx.out.filter((s) => shiftYmdLocal(s.starts_at) === wd.ymd).map((s) => s.staff_member_id)
    ).size;

    if (distinct === 0) {
      shortfalls.push({
        ymd: wd.ymd,
        kind: "empty_day",
        label,
        wanted: baseTarget,
        placed: 0,
        missing: baseTarget,
        teamGap: Math.max(0, baseTarget - ctx.active.length),
      });
    }

    for (const band of wd.openingBands) {
      const serviceTarget = requiredCoverageForBand(wd, band, ctx);
      const minCov = minCoverageInBand(ctx.out, wd.ymd, band);
      if (minCov >= serviceTarget) continue;
      const slot = worstCoverageSlot(ctx.out, wd.ymd, band);
      shortfalls.push({
        ymd: wd.ymd,
        kind: "service",
        label: `${label} · ${band.start}–${band.end} (min. ${hhmmFromMinutes(slot)} : ${minCov}/${serviceTarget})`,
        wanted: serviceTarget,
        placed: minCov,
        missing: serviceTarget - minCov,
        teamGap: Math.max(0, serviceTarget - ctx.active.length),
      });
    }

    for (const peak of peaks) {
      const band: TimeBand = { start: peak.start, end: peak.end };
      const want = Math.min(Math.ceil(peak.staffCount), ctx.active.length);
      const got = minCoverageInBand(ctx.out, wd.ymd, band);
      if (got >= want) continue;
      shortfalls.push({
        ymd: wd.ymd,
        kind: "peak",
        label: `${label} · pointe ${peak.start}–${peak.end} (${got}/${want})`,
        wanted: want,
        placed: got,
        missing: want - got,
        teamGap: Math.max(0, want - ctx.active.length),
      });
    }
  }

  return shortfalls;
}

function buildSummaryFr(shortfalls: PlanningGenerationShortfall[], ctx: Ctx): string | null {
  const parts: string[] = [];

  const underContract = ctx.active.filter((m) => {
    const bud = ctx.weeklyBudget.get(m.id);
    return bud != null && bud > 0 && remainingWeeklyNet(m, ctx) >= 120;
  });
  if (underContract.length > 0) {
    parts.push(
      `${underContract.length} collaborateur(s) n’atteignent pas leur volume hebdo — vérifiez disponibilités et plafonds journaliers.`
    );
  }

  if (shortfalls.length === 0) return parts.length > 0 ? parts.join(" ") : null;

  if (shortfalls.some((s) => s.kind === "empty_day")) {
    parts.push("Des jours ouverts n’ont personne de planifié.");
  }
  if (shortfalls.some((s) => s.kind === "peak")) {
    parts.push("Certaines heures de pointe restent sous l’effectif demandé.");
  }
  if (shortfalls.some((s) => s.kind === "service")) {
    parts.push("Certaines plages de service ne sont pas couvertes sur toute leur durée.");
  }

  return parts.join(" ");
}

/**
 * Génère l’ébauche en 3 étapes :
 * 1. Couverture continue de chaque plage d’ouverture (effectif cible simultané)
 * 2. Renfort des heures de pointe (effectif pointe du wizard)
 * 3. Complément des heures de contrat hebdomadaires
 */
export function generateAutoSimulationShifts(params: {
  resolvedWeekDays: WeekResolvedDay[];
  staff: StaffMember[];
  excludedStaffIds?: string[];
  options?: PlanningSimulationOptions;
}): PlanningGenerationResult {
  const { resolvedWeekDays, staff, excludedStaffIds = [], options } = params;
  const excluded = new Set(excludedStaffIds);
  const active = staff.filter((s) => s.active && !excluded.has(s.id));

  if (active.length === 0) {
    return { shifts: [], shortfalls: [], summaryFr: "Aucun collaborateur disponible." };
  }

  const ctx: Ctx = {
    active,
    weeklyBudget: new Map(active.map((m) => [m.id, buildWeeklyBudgetMinutes(m, options)])),
    usedNet: new Map(active.map((m) => [m.id, 0])),
    dailyUsedNet: new Map(),
    out: [],
    options,
  };

  const openDays = resolvedWeekDays.filter((wd) => wd.openingBands.length > 0);

  coverServiceBandsFairly(openDays, ctx);
  coverPeakBandsFairly(openDays, ctx);

  fillContractHours(ctx, openDays);
  fillSecondBandSameDay(ctx, openDays);

  const shortfalls = computeShortfalls(openDays, ctx);
  const summaryFr = buildSummaryFr(shortfalls, ctx);

  return { shifts: ctx.out, shortfalls, summaryFr };
}
