import { minutesFromMidnight, type PlanningDayKey, type TimeBand } from "@/lib/staff/planningHoursTypes";

/**
 * Solveur / évaluateur de contraintes (OBJECTIF 2).
 * Évalue un ensemble de créneaux contre le contexte ingéré et produit un score
 * basé sur des contraintes HARD (éliminatoires) et SOFT (préférences).
 */

const SLOT_STEP = 30;
const NIGHT_CLOSE_MINUTE = 22 * 60; // 22:00 : seuil "nocturne"
const CONTRACT_TOLERANCE_MIN = 15; // marge avant de considérer un dépassement contrat

export type ConstraintSeverity = "hard" | "soft";

export interface ConstraintViolation {
  code:
    | "contract_overflow"
    | "lone_worker"
    | "below_security_floor"
    | "absence_conflict"
    | "night_closing_understaffed"
    | "non_consecutive_rest";
  severity: ConstraintSeverity;
  staffMemberId?: string;
  staffName?: string;
  dayKey?: PlanningDayKey;
  ymd?: string;
  /** Minute (depuis minuit) du créneau concerné, si applicable. */
  minute?: number;
  message: string;
}

/** Créneau normalisé pour l'évaluation (indépendant du modèle DB). */
export interface SolverShift {
  staffMemberId: string;
  staffName: string;
  dayKey: PlanningDayKey;
  ymd: string;
  /** Minutes depuis minuit, heure murale locale. */
  startMinute: number;
  endMinute: number;
  /** Minutes de pause incluses dans [start,end]. */
  breakMinutes: number;
}

export interface SolverMember {
  staffMemberId: string;
  staffName: string;
  /** Volume hebdo contractuel en minutes (null = non plafonné). */
  contractWeeklyMinutes: number | null;
  fixedRestDays: PlanningDayKey[];
  requireConsecutiveRest: boolean;
}

export interface SolverDay {
  dayKey: PlanningDayKey;
  ymd: string;
  openingBands: TimeBand[];
}

export interface SolverContext {
  days: SolverDay[];
  members: SolverMember[];
  securityFloor: number;
  /** ymd → set de staffMemberId absents (congé/indispo). */
  absencesByYmd: Record<string, Set<string>>;
}

export interface SolverReport {
  hardViolations: ConstraintViolation[];
  softViolations: ConstraintViolation[];
  /** 0 = parfait. Plus élevé = pire (HARD pèse 1000, SOFT pèse 1). */
  score: number;
  feasible: boolean;
}

const HARD_WEIGHT = 1000;
const SOFT_WEIGHT = 1;

function shiftCoversSlot(s: SolverShift, minute: number): boolean {
  return minute >= s.startMinute && minute < s.endMinute;
}

/** Effectif simultané présent à une minute donnée d'un jour. */
function headcountAt(shifts: SolverShift[], minute: number): number {
  let n = 0;
  for (const s of shifts) if (shiftCoversSlot(s, minute)) n += 1;
  return n;
}

function dayOpeningSlots(day: SolverDay): number[] {
  const out: number[] = [];
  for (const b of day.openingBands) {
    const a = minutesFromMidnight(b.start);
    const e = minutesFromMidnight(b.end);
    if (a == null || e == null || e <= a) continue;
    for (let m = a; m + SLOT_STEP <= e; m += SLOT_STEP) out.push(m);
  }
  return out;
}

function dayClosesAtNight(day: SolverDay): { isNight: boolean; closeMinute: number | null } {
  let close: number | null = null;
  for (const b of day.openingBands) {
    const e = minutesFromMidnight(b.end);
    if (e != null) close = close == null ? e : Math.max(close, e);
  }
  return { isNight: close != null && close >= NIGHT_CLOSE_MINUTE, closeMinute: close };
}

export function evaluatePlanning(shifts: SolverShift[], ctx: SolverContext): SolverReport {
  const hard: ConstraintViolation[] = [];
  const soft: ConstraintViolation[] = [];
  const shiftsByYmd = groupBy(shifts, (s) => s.ymd);

  // ── HARD : dépassement contrat (sur la semaine) ────────────────────────────
  const workedByMember = new Map<string, number>();
  for (const s of shifts) {
    const net = Math.max(0, s.endMinute - s.startMinute - s.breakMinutes);
    workedByMember.set(s.staffMemberId, (workedByMember.get(s.staffMemberId) ?? 0) + net);
  }
  for (const m of ctx.members) {
    if (m.contractWeeklyMinutes == null) continue;
    const worked = workedByMember.get(m.staffMemberId) ?? 0;
    if (worked > m.contractWeeklyMinutes + CONTRACT_TOLERANCE_MIN) {
      hard.push({
        code: "contract_overflow",
        severity: "hard",
        staffMemberId: m.staffMemberId,
        staffName: m.staffName,
        message: `${m.staffName} : ${fmtH(worked)} planifiées pour un contrat de ${fmtH(
          m.contractWeeklyMinutes
        )} (dépassement).`,
      });
    }
  }

  // ── HARD : absences non respectées ─────────────────────────────────────────
  for (const s of shifts) {
    const absent = ctx.absencesByYmd[s.ymd];
    if (absent?.has(s.staffMemberId)) {
      hard.push({
        code: "absence_conflict",
        severity: "hard",
        staffMemberId: s.staffMemberId,
        staffName: s.staffName,
        dayKey: s.dayKey,
        ymd: s.ymd,
        message: `${s.staffName} est planifié(e) le ${s.ymd} alors qu'il/elle est en congé/indisponible.`,
      });
    }
  }

  // ── HARD : talon de sécurité & personne seule & nocturne ───────────────────
  const floor = Math.max(2, Math.round(ctx.securityFloor)); // jamais < 2 (personne seule interdite)
  for (const day of ctx.days) {
    const dayShifts = shiftsByYmd.get(day.ymd) ?? [];
    const slots = dayOpeningSlots(day);
    if (slots.length === 0) continue;

    let reportedFloor = false;
    let reportedLone = false;
    for (const minute of slots) {
      const head = headcountAt(dayShifts, minute);
      if (head === 1 && !reportedLone) {
        reportedLone = true;
        hard.push({
          code: "lone_worker",
          severity: "hard",
          dayKey: day.dayKey,
          ymd: day.ymd,
          minute,
          message: `${day.ymd} : une seule personne sur site à ${fmtMin(minute)} (interdit).`,
        });
      } else if (head < floor && head !== 1 && !reportedFloor) {
        reportedFloor = true;
        hard.push({
          code: "below_security_floor",
          severity: "hard",
          dayKey: day.dayKey,
          ymd: day.ymd,
          minute,
          message: `${day.ymd} : effectif ${head} < talon de sécurité ${floor} à ${fmtMin(minute)}.`,
        });
      }
    }

    // Nocturne estivale : < 2 présents à la fermeture.
    const { isNight, closeMinute } = dayClosesAtNight(day);
    if (isNight && closeMinute != null) {
      const lastSlot = closeMinute - SLOT_STEP;
      const closers = headcountAt(dayShifts, lastSlot);
      if (closers < 2) {
        hard.push({
          code: "night_closing_understaffed",
          severity: "hard",
          dayKey: day.dayKey,
          ymd: day.ymd,
          minute: lastSlot,
          message: `${day.ymd} : ${closers} fermeur(s) en nocturne (minimum 2 requis).`,
        });
      }
    }
  }

  // ── SOFT : jours de repos non consécutifs ──────────────────────────────────
  const workedDaysByMember = new Map<string, Set<PlanningDayKey>>();
  for (const s of shifts) {
    let set = workedDaysByMember.get(s.staffMemberId);
    if (!set) { set = new Set(); workedDaysByMember.set(s.staffMemberId, set); }
    set.add(s.dayKey);
  }
  for (const m of ctx.members) {
    if (!m.requireConsecutiveRest) continue;
    const worked = workedDaysByMember.get(m.staffMemberId) ?? new Set();
    const restDays = (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as PlanningDayKey[]).filter(
      (d) => !worked.has(d)
    );
    if (restDays.length >= 2 && !hasConsecutivePair(restDays)) {
      soft.push({
        code: "non_consecutive_rest",
        severity: "soft",
        staffMemberId: m.staffMemberId,
        staffName: m.staffName,
        message: `${m.staffName} : jours de repos non consécutifs (préférence non respectée).`,
      });
    }
  }

  const score = hard.length * HARD_WEIGHT + soft.length * SOFT_WEIGHT;
  return { hardViolations: hard, softViolations: soft, score, feasible: hard.length === 0 };
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

const DAY_ORDER: PlanningDayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function hasConsecutivePair(restDays: PlanningDayKey[]): boolean {
  const idx = restDays.map((d) => DAY_ORDER.indexOf(d)).sort((a, b) => a - b);
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] - idx[i - 1] === 1) return true;
  }
  // dimanche+lundi considérés consécutifs (semaine cyclique)
  if (idx.includes(0) && idx.includes(6)) return true;
  return false;
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const list = m.get(k);
    if (list) list.push(item);
    else m.set(k, [item]);
  }
  return m;
}

function fmtMin(minute: number): string {
  const h = Math.floor(minute / 60);
  const mm = minute % 60;
  return `${String(h).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}

function fmtH(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
