/**
 * Diagnostic local de l'ébauche auto — npx tsx scripts/debug-auto-simulation.ts
 */
import { generateAutoSimulationShifts } from "../lib/staff/autoSimulation";
import { type WeekResolvedDay } from "../lib/staff/planningResolve";
import type { StaffMember } from "../lib/staff/types";

function mkStaff(
  id: string,
  name: string,
  hours: number,
  maxDaily: number | null = 10
): StaffMember {
  return {
    id,
    restaurant_id: "r1",
    display_name: name,
    role: "serveur",
    active: true,
    color_index: null,
    user_id: null,
    app_role: null,
    app_nav_keys: null,
    target_weekly_hours: hours,
    max_daily_hours: maxDaily,
    planning_carryover_minutes: 0,
    planning_notes: null,
    availability_json: {},
    planning_prep_bands_json: {},
    planning_fixed_rest_days: [],
    planning_weekly_rest_days: 2,
    planning_require_consecutive_rest: true,
    planning_default_shift_pattern: "continuous",
    created_at: "",
    updated_at: "",
  };
}

function mkDay(ymd: string, dayKey: WeekResolvedDay["dayKey"], target: number): WeekResolvedDay {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return {
    ymd,
    dayKey,
    date,
    openingBands: [{ start: "11:00", end: "15:00" }, { start: "19:00", end: "23:00" }],
    staffExtraBands: [],
    staffTarget: target,
    exceptionLabel: null,
  };
}

function mkLongDay(ymd: string, dayKey: WeekResolvedDay["dayKey"], target: number): WeekResolvedDay {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return {
    ymd,
    dayKey,
    date,
    openingBands: [{ start: "10:00", end: "20:00" }],
    staffExtraBands: [],
    staffTarget: target,
    exceptionLabel: null,
  };
}

const staff = [
  mkStaff("1", "Alice", 35),
  mkStaff("2", "Bob", 35),
  mkStaff("3", "Claire", 35),
  mkStaff("4", "David", 35),
  mkStaff("5", "Emma", 35),
  mkStaff("6", "Franck", 35),
];

const days: WeekResolvedDay[] = [
  mkDay("2026-05-18", "mon", 4),
  mkDay("2026-05-19", "tue", 4),
  mkDay("2026-05-20", "wed", 4),
  mkDay("2026-05-21", "thu", 5),
  mkDay("2026-05-22", "fri", 6),
  mkDay("2026-05-23", "sat", 6),
  mkDay("2026-05-24", "sun", 5),
];

const { shifts, shortfalls, summaryFr } = generateAutoSimulationShifts({
  resolvedWeekDays: days,
  staff,
  options: {
    securityFloor: 2,
    peakBandsByDay: {
      "2026-05-22": [{ start: "12:00", end: "14:00", staffCount: 6 }],
      "2026-05-23": [{ start: "12:00", end: "14:00", staffCount: 6 }],
    },
  },
});

function netMin(start: string, end: string, br: number | null): number {
  const st = new Date(start);
  const en = new Date(end);
  const gross = (en.getTime() - st.getTime()) / 60000;
  return Math.max(0, gross - (br ?? 0));
}

function minCoverage(shiftsToCheck: typeof shifts, ymd: string, start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh! * 60 + sm!;
  const endMin = eh! * 60 + em!;
  let min = Infinity;
  for (let minute = startMin; minute + 30 <= endMin; minute += 30) {
    const ids = new Set<string>();
    for (const s of shiftsToCheck) {
      const d = new Date(s.starts_at);
      const sy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (sy !== ymd) continue;
      const e = new Date(s.ends_at);
      const ss = d.getHours() * 60 + d.getMinutes();
      const se = e.getHours() * 60 + e.getMinutes();
      if (ss <= minute && se >= minute + 30) ids.add(s.staff_member_id);
    }
    min = Math.min(min, ids.size);
  }
  return min === Infinity ? 0 : min;
}

const used = new Map<string, number>();
const workedDays = new Map<string, Set<string>>();
for (const s of shifts) {
  used.set(s.staff_member_id, (used.get(s.staff_member_id) ?? 0) + netMin(s.starts_at, s.ends_at, s.break_minutes));
  const d = new Date(s.starts_at);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const daysForStaff = workedDays.get(s.staff_member_id) ?? new Set<string>();
  daysForStaff.add(ymd);
  workedDays.set(s.staff_member_id, daysForStaff);
}

console.log("Shifts:", shifts.length);
console.log("Shortfalls:", shortfalls.length);
console.log("Summary:", summaryFr);
console.log("Min talon dimanche midi:", minCoverage(shifts, "2026-05-24", "11:00", "15:00"));
console.log("Min talon dimanche soir:", minCoverage(shifts, "2026-05-24", "19:00", "23:00"));
console.log("\nHeures nettes / personne:");
for (const m of staff) {
  const h = ((used.get(m.id) ?? 0) / 60).toFixed(1);
  console.log(`  ${m.display_name}: ${h}h / ${m.target_weekly_hours}h · ${workedDays.get(m.id)?.size ?? 0}j travaillés`);
}
if (shortfalls.length) {
  console.log("\nShortfalls:");
  for (const s of shortfalls.slice(0, 8)) console.log(" ", s.label, s.placed, "/", s.wanted);
}

const longDays: WeekResolvedDay[] = [
  mkLongDay("2026-05-18", "mon", 2),
  mkLongDay("2026-05-19", "tue", 2),
  mkLongDay("2026-05-20", "wed", 2),
  mkLongDay("2026-05-21", "thu", 2),
  mkLongDay("2026-05-22", "fri", 2),
  mkLongDay("2026-05-23", "sat", 2),
  mkLongDay("2026-05-24", "sun", 2),
];
const longScenario = generateAutoSimulationShifts({
  resolvedWeekDays: longDays,
  staff,
  options: { securityFloor: 2 },
});

const longUsed = new Map<string, number>();
const longWorkedDays = new Map<string, Set<string>>();
for (const s of longScenario.shifts) {
  longUsed.set(s.staff_member_id, (longUsed.get(s.staff_member_id) ?? 0) + netMin(s.starts_at, s.ends_at, s.break_minutes));
  const d = new Date(s.starts_at);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const daysForStaff = longWorkedDays.get(s.staff_member_id) ?? new Set<string>();
  daysForStaff.add(ymd);
  longWorkedDays.set(s.staff_member_id, daysForStaff);
}

console.log("\nLongue amplitude:");
console.log("Shifts:", longScenario.shifts.length);
console.log("Shortfalls:", longScenario.shortfalls.length);
console.log("Summary:", longScenario.summaryFr);
for (const m of staff) {
  const h = ((longUsed.get(m.id) ?? 0) / 60).toFixed(1);
  console.log(`  ${m.display_name}: ${h}h / ${m.target_weekly_hours}h · ${longWorkedDays.get(m.id)?.size ?? 0}j travaillés`);
}
