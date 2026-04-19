import type { WeekResolvedDay } from "@/lib/staff/planningResolve";
import { mergedStaffWorkBands, shiftContainedInTimeBands } from "@/lib/staff/staffWorkWindows";
import { addDays, toISODateString } from "@/lib/staff/weekUtils";
import type { StaffMember, WorkShiftWithDetails } from "@/lib/staff/types";
import { type PlanningDayKey, PLANNING_DAY_KEYS, PLANNING_DAY_LABELS } from "@/lib/staff/planningHoursTypes";

export type PlanningAlertLevel = "error" | "warning" | "info";

export type PlanningAlert = {
  level: PlanningAlertLevel;
  message: string;
};

/** Index du lundi dans week (0 = mon … 6 = sun) pour une date locale. */
export function mondayIndexLocal(d: Date): number {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  return day === 0 ? 6 : day - 1;
}

export function planningDayKeyForLocalDate(d: Date): PlanningDayKey {
  const idx = mondayIndexLocal(d);
  return PLANNING_DAY_KEYS[idx];
}

/** Chevauchement [a0,a1) et [b0,b1). */
function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

function shiftOverlapMinutes(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 60000);
}

/**
 * Alertes : chevauchements de créneaux, hors horaires d’ouverture, volume vs cible, pause longue journée, pointage tardif.
 */
function shiftOverlapsLocalCalendarDay(start: Date, end: Date, dayMidnight: Date): boolean {
  const ds = new Date(dayMidnight);
  ds.setHours(0, 0, 0, 0);
  const de = addDays(ds, 1);
  return start < de && end > ds;
}

export function computePlanningAlerts(params: {
  weekStartMonday: Date;
  shifts: WorkShiftWithDetails[];
  staff: StaffMember[];
  resolvedWeekDays: WeekResolvedDay[];
}): PlanningAlert[] {
  const { weekStartMonday, shifts, staff, resolvedWeekDays } = params;
  const alerts: PlanningAlert[] = [];

  const weekEnd = new Date(weekStartMonday);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const byStaff = new Map<string, WorkShiftWithDetails[]>();
  for (const s of shifts) {
    const list = byStaff.get(s.staff_member_id) ?? [];
    list.push(s);
    byStaff.set(s.staff_member_id, list);
  }

  /** Chevauchements même personne */
  for (const [staffId, list] of byStaff) {
    const sorted = [...list].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    outer: for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        const a0 = new Date(a.starts_at).getTime();
        const a1 = new Date(a.ends_at).getTime();
        const b0 = new Date(b.starts_at).getTime();
        const b1 = new Date(b.ends_at).getTime();
        if (rangesOverlap(a0, a1, b0, b1)) {
          const name = staff.find((m) => m.id === staffId)?.display_name ?? "Collaborateur";
          alerts.push({
            level: "error",
            message: `Créneaux qui se chevauchent pour ${name}.`,
          });
          break outer;
        }
      }
    }
  }

  /** Créneau vs plages autorisées (service client ∩ dispo + prépa hors client) */
  for (const s of shifts) {
    const start = new Date(s.starts_at);
    const end = new Date(s.ends_at);
    if (start >= weekEnd || end <= weekStartMonday) continue;

    const ymd = toISODateString(start);
    const key = planningDayKeyForLocalDate(start);

    if (start.toDateString() !== end.toDateString()) {
      alerts.push({
        level: "info",
        message: `Créneau ${s.staff_display_name} sur deux jours : vérifiez manuellement.`,
      });
      continue;
    }

    const member = staff.find((m) => m.id === s.staff_member_id);
    if (!member) continue;
    const wd = resolvedWeekDays.find((w) => w.ymd === ymd);
    if (!wd) continue;

    const allowed = mergedStaffWorkBands(member, wd);
    if (allowed.length === 0) {
      alerts.push({
        level: "warning",
        message: `Créneau ${s.staff_display_name} (${formatRange(start, end)}) : aucune plage service / prépa renseignée pour le ${PLANNING_DAY_LABELS[key]}.`,
      });
      continue;
    }
    if (!shiftContainedInTimeBands(start, end, allowed)) {
      alerts.push({
        level: "warning",
        message: `Créneau ${s.staff_display_name} (${formatRange(start, end)}) : hors des plages service / prépa du ${PLANNING_DAY_LABELS[key]}.`,
      });
    }
  }

  /** Effectif du jour vs objectif (établissement) */
  for (const wd of resolvedWeekDays) {
    if (wd.staffTarget == null) continue;
    const ids = new Set<string>();
    for (const s of shifts) {
      const s0 = new Date(s.starts_at);
      const s1 = new Date(s.ends_at);
      if (shiftOverlapsLocalCalendarDay(s0, s1, wd.date)) {
        ids.add(s.staff_member_id);
      }
    }
    const n = ids.size;
    const t = wd.staffTarget;
    const dayLabel = wd.date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    if (n < t) {
      alerts.push({
        level: "warning",
        message: `${dayLabel}${wd.exceptionLabel ? ` (${wd.exceptionLabel})` : ""} : ${n} personne(s) planifiée(s) pour un objectif de ${t}.`,
      });
    } else if (t > 0 && n > Math.ceil(t * 1.25)) {
      alerts.push({
        level: "info",
        message: `${dayLabel} : ${n} personnes planifiées pour un objectif de ${t} (marge élevée).`,
      });
    }
  }

  /** Volume hebdo vs cible */
  for (const m of staff) {
    if (m.target_weekly_hours == null || !Number.isFinite(Number(m.target_weekly_hours))) continue;
    const target = Number(m.target_weekly_hours);
    const list = byStaff.get(m.id) ?? [];
    let totalMin = 0;
    for (const s of list) {
      totalMin += shiftOverlapMinutes(new Date(s.starts_at), new Date(s.ends_at));
    }
    const hours = totalMin / 60;
    if (hours > target * 1.15 && target > 0) {
      alerts.push({
        level: "warning",
        message: `${m.display_name} : environ ${hours.toFixed(1)} h planifiées sur la semaine, au-dessus de l’objectif ${target} h (+15 %).`,
      });
    } else if (hours > 0 && hours < target * 0.85 && target > 0) {
      alerts.push({
        level: "info",
        message: `${m.display_name} : environ ${hours.toFixed(1)} h planifiées, sous l’objectif ${target} h (−15 %).`,
      });
    }
  }

  /** Longue plage sans pause renseignée */
  for (const s of shifts) {
    const plannedMin = shiftOverlapMinutes(new Date(s.starts_at), new Date(s.ends_at));
    const brk = s.break_minutes ?? 0;
    if (plannedMin >= 6 * 60 && brk < 20) {
      alerts.push({
        level: "info",
        message: `Créneau long (${formatMinutes(plannedMin)}) pour ${s.staff_display_name} : pensez à indiquer une pause (repas) sur le créneau.`,
      });
    }
  }

  /** Pointage tardif (> 15 min après le début prévu) */
  for (const s of shifts) {
    const plannedStart = new Date(s.starts_at).getTime();
    const cin = s.attendance?.clock_in_at ? new Date(s.attendance.clock_in_at).getTime() : null;
    if (cin != null && cin - plannedStart > 15 * 60000) {
      alerts.push({
        level: "warning",
        message: `${s.staff_display_name} : entrée pointée plus de 15 min après l’heure prévue.`,
      });
    }
  }

  return dedupeAlerts(alerts);
}

function formatRange(a: Date, b: Date): string {
  return `${a.toLocaleString("fr-FR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} → ${b.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return `${h} h${mm > 0 ? ` ${mm} min` : ""}`;
}

function dedupeAlerts(a: PlanningAlert[]): PlanningAlert[] {
  const seen = new Set<string>();
  const out: PlanningAlert[] = [];
  for (const x of a) {
    const k = `${x.level}:${x.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}
