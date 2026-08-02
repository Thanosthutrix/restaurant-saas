import type { GeneratedSimulationShift } from "@/lib/staff/autoSimulation";
import {
  extractShiftsFromGenerativePayload,
  extractShiftsFromNestedPlanningJson,
  findStaffIdByDisplayName,
  normalizePlanningPersonName,
} from "@/lib/staff/aiPlanningSimulation";
import { parisWallClockToUtc, parisYmdFromInstant } from "@/lib/staff/planningParisWall";
import { plannedDurationMinutes } from "@/lib/staff/timeHelpers";
import type { StaffMember } from "@/lib/staff/types";
import { mondayOfWeekContaining, parseISODateLocal, toISODateString } from "@/lib/staff/weekUtils";

export type PlanningImportApplyResult = {
  shiftsByWeek: Map<string, GeneratedSimulationShift[]>;
  totalShiftCount: number;
  skippedCount: number;
  unmatchedNames: string[];
  rationale: string | null;
  notes: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  weekMondays: string[];
};

export type PlanningImportEntry = {
  d: string;
  n: string;
  s: string;
  e: string;
  b?: number | null;
};

function defaultBreakMinutes(durM: number, explicit: unknown): number | null {
  if (explicit != null && Number.isFinite(Number(explicit))) {
    const b = Math.round(Number(explicit));
    if (b >= 0 && b < durM) return b;
  }
  return durM > 360 ? 30 : null;
}

export function weekMondayYmdFromShiftStart(startsAt: string): string | null {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const ymd = parisYmdFromInstant(start);
  const parsed = parseISODateLocal(ymd);
  if (!parsed) return null;
  return toISODateString(mondayOfWeekContaining(parsed));
}

export function groupShiftsByWeekMonday(shifts: GeneratedSimulationShift[]): Map<string, GeneratedSimulationShift[]> {
  const map = new Map<string, GeneratedSimulationShift[]>();
  for (const s of shifts) {
    const monday = weekMondayYmdFromShiftStart(s.starts_at);
    if (!monday) continue;
    const list = map.get(monday) ?? [];
    list.push(s);
    map.set(monday, list);
  }
  return map;
}

/** Extraction souple : chevauchement par collaborateur × jour civil (Paris). */
function validateImportedShifts(params: {
  raw: GeneratedSimulationShift[];
  staffById: Map<string, StaffMember>;
}): GeneratedSimulationShift[] {
  const sorted = [...params.raw].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  const lastEndMs = new Map<string, number>();
  const out: GeneratedSimulationShift[] = [];

  for (const row of sorted) {
    const member = params.staffById.get(row.staff_member_id);
    if (!member) continue;

    const start = new Date(row.starts_at);
    const end = new Date(row.ends_at);
    if (!(start < end) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    const dayKey = `${member.id}:${parisYmdFromInstant(start)}`;
    const prevEnd = lastEndMs.get(dayKey) ?? 0;
    if (start.getTime() < prevEnd) continue;

    const grossM = plannedDurationMinutes(row.starts_at, row.ends_at);
    if (grossM < 15) continue;

    let breakM = row.break_minutes;
    if (breakM != null && (!Number.isFinite(breakM) || breakM < 0 || breakM >= grossM)) {
      breakM = defaultBreakMinutes(grossM, null);
    } else if (breakM == null) {
      breakM = defaultBreakMinutes(grossM, null);
    }

    lastEndMs.set(dayKey, end.getTime());
    out.push({
      staff_member_id: row.staff_member_id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      break_minutes: breakM,
      notes: row.notes?.trim() ? row.notes.trim().slice(0, 400) : "Import planning",
    });
  }

  return out;
}

function collectUnmatchedFromPlanning(parsed: unknown, active: StaffMember[]): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as Record<string, unknown>;
  const unmatched = new Set<string>();

  if (Array.isArray(rec.unmatched_names)) {
    for (const x of rec.unmatched_names) {
      if (typeof x === "string" && x.trim()) unmatched.add(x.trim());
    }
  }

  const plan = rec.planning;
  if (!Array.isArray(plan)) return [...unmatched];

  for (const dayBlock of plan) {
    if (!dayBlock || typeof dayBlock !== "object") continue;
    const staffList = (dayBlock as Record<string, unknown>).staff;
    if (!Array.isArray(staffList)) continue;
    for (const person of staffList) {
      if (!person || typeof person !== "object") continue;
      const nm = typeof (person as Record<string, unknown>).name === "string" ? String((person as Record<string, unknown>).name) : "";
      if (!nm.trim()) continue;
      if (!findStaffIdByDisplayName(active, nm)) unmatched.add(nm.trim());
    }
  }
  return [...unmatched];
}

function extractPeriod(parsed: unknown): { start: string | null; end: string | null } {
  if (!parsed || typeof parsed !== "object") return { start: null, end: null };
  const r = parsed as Record<string, unknown>;
  const start = typeof r.period_start === "string" ? r.period_start.trim().slice(0, 10) : null;
  const end = typeof r.period_end === "string" ? r.period_end.trim().slice(0, 10) : null;
  return {
    start: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
    end: end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : null,
  };
}

/** Normalise entries compactes + planning nested vers une liste flat. */
export function collectPlanningImportEntries(parsed: unknown): PlanningImportEntry[] {
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as Record<string, unknown>;
  const out: PlanningImportEntry[] = [];

  if (Array.isArray(rec.entries)) {
    for (const row of rec.entries) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const d = typeof r.d === "string" ? r.d.trim().slice(0, 10) : typeof r.date === "string" ? r.date.trim().slice(0, 10) : "";
      const n = typeof r.n === "string" ? r.n : typeof r.name === "string" ? r.name : "";
      const s = typeof r.s === "string" ? r.s : typeof r.start === "string" ? r.start : "";
      const e = typeof r.e === "string" ? r.e : typeof r.end === "string" ? r.end : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !n.trim() || !s || !e) continue;
      const b = r.b ?? r.break_minutes;
      out.push({
        d,
        n: n.trim(),
        s: s.trim(),
        e: e.trim(),
        b: b != null && Number.isFinite(Number(b)) ? Number(b) : null,
      });
    }
  }

  const plan = rec.planning;
  if (Array.isArray(plan)) {
    for (const dayBlock of plan) {
      if (!dayBlock || typeof dayBlock !== "object") continue;
      const dr = dayBlock as Record<string, unknown>;
      const dateStr = typeof dr.date === "string" ? dr.date.trim().slice(0, 10) : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || dr.closed === true) continue;
      const staffList = dr.staff;
      if (!Array.isArray(staffList)) continue;
      for (const person of staffList) {
        if (!person || typeof person !== "object") continue;
        const pr = person as Record<string, unknown>;
        const nm = typeof pr.name === "string" ? pr.name.trim() : "";
        if (!nm) continue;
        const shiftsArr = pr.shifts;
        if (!Array.isArray(shiftsArr)) continue;
        for (const sh of shiftsArr) {
          if (!sh || typeof sh !== "object") continue;
          const sr = sh as Record<string, unknown>;
          const startClock = typeof sr.start === "string" ? sr.start.trim() : "";
          const endClock = typeof sr.end === "string" ? sr.end.trim() : "";
          if (!startClock || !endClock) continue;
          out.push({
            d: dateStr,
            n: nm,
            s: startClock,
            e: endClock,
            b: sr.break_minutes != null && Number.isFinite(Number(sr.break_minutes)) ? Number(sr.break_minutes) : null,
          });
        }
      }
    }
  }

  return out;
}

function entriesToShifts(entries: PlanningImportEntry[], active: StaffMember[]): GeneratedSimulationShift[] {
  const out: GeneratedSimulationShift[] = [];
  for (const entry of entries) {
    const staffId = findStaffIdByDisplayName(active, entry.n);
    if (!staffId) continue;
    const startDt = parisWallClockToUtc(entry.d, entry.s);
    const endDt = parisWallClockToUtc(entry.d, entry.e);
    if (!startDt || !endDt || !(startDt < endDt)) continue;
    const durM = plannedDurationMinutes(startDt.toISOString(), endDt.toISOString());
    if (durM < 15) continue;
    out.push({
      staff_member_id: staffId,
      starts_at: startDt.toISOString(),
      ends_at: endDt.toISOString(),
      break_minutes: defaultBreakMinutes(durM, entry.b),
      notes: `Import · ${entry.s}–${entry.e}`,
    });
  }
  return out;
}

function extractShiftsFromImportJson(parsed: unknown, active: StaffMember[]): GeneratedSimulationShift[] {
  const fromEntries = entriesToShifts(collectPlanningImportEntries(parsed), active);
  if (fromEntries.length > 0) return fromEntries;

  const nested = extractShiftsFromNestedPlanningJson(parsed, active);
  if (nested.length > 0) return nested;

  return extractShiftsFromGenerativePayload(parsed);
}

export function countDistinctDatesInParsed(parsed: unknown): number {
  const dates = new Set(collectPlanningImportEntries(parsed).map((e) => e.d));
  return dates.size;
}

export function applyPlanningImportJson(params: {
  parsed: unknown;
  staff: StaffMember[];
}): PlanningImportApplyResult {
  const active = params.staff.filter((s) => s.active);
  const staffById = new Map(active.map((s) => [s.id, s]));

  const rawExtracted = extractShiftsFromImportJson(params.parsed, active);
  const shifts = validateImportedShifts({ raw: rawExtracted, staffById });
  const shiftsByWeek = groupShiftsByWeekMonday(shifts);
  const weekMondays = [...shiftsByWeek.keys()].sort();

  const aiUnmatched =
    params.parsed && typeof params.parsed === "object" && Array.isArray((params.parsed as Record<string, unknown>).unmatched_names) ?
      ((params.parsed as Record<string, unknown>).unmatched_names as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
    : [];

  const computedUnmatched = collectUnmatchedFromPlanning(params.parsed, active);
  const unmatchedSet = new Set([...aiUnmatched, ...computedUnmatched]);

  for (const name of computedUnmatched) {
    const key = normalizePlanningPersonName(name);
    const matched = active.some((m) => normalizePlanningPersonName(m.display_name ?? "") === key);
    if (matched) unmatchedSet.delete(name);
  }

  const { start: periodStart, end: periodEnd } = extractPeriod(params.parsed);

  const rationale =
    params.parsed && typeof params.parsed === "object" ?
      (() => {
        const r = (params.parsed as Record<string, unknown>).rationale_short;
        return typeof r === "string" && r.trim() ? r.trim() : null;
      })()
    : null;

  const notes =
    params.parsed && typeof params.parsed === "object" ?
      (() => {
        const n = (params.parsed as Record<string, unknown>).notes;
        return typeof n === "string" && n.trim() ? n.trim() : null;
      })()
    : null;

  return {
    shiftsByWeek,
    totalShiftCount: shifts.length,
    skippedCount: Math.max(0, rawExtracted.length - shifts.length),
    unmatchedNames: [...unmatchedSet],
    rationale,
    notes,
    periodStart,
    periodEnd,
    weekMondays,
  };
}
