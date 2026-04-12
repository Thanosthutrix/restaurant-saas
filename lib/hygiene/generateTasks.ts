import type { HygieneElement } from "./types";
import { eachCalendarDayInclusive, endOfUtcDayIso, daysInMonthUtc, yearMonth, ymd } from "./dates";

type TaskInsert = {
  restaurant_id: string;
  element_id: string;
  period_key: string;
  due_at: string;
  risk_level: string;
  status: "pending";
};

/**
 * Génère les lignes de tâches à insérer pour un élément actif sur une fenêtre [start, end].
 * `after_each_service` : aucune génération automatique.
 */
export function buildTaskInsertsForElement(
  el: HygieneElement,
  windowStart: Date,
  windowEnd: Date
): TaskInsert[] {
  const out: TaskInsert[] = [];
  const risk = el.risk_level;

  if (el.recurrence_type === "after_each_service") {
    return out;
  }

  if (el.recurrence_type === "daily") {
    const days = eachCalendarDayInclusive(windowStart, windowEnd);
    for (const d of days) {
      out.push({
        restaurant_id: el.restaurant_id,
        element_id: el.id,
        period_key: `d:${d}`,
        due_at: endOfUtcDayIso(d),
        risk_level: risk,
        status: "pending",
      });
    }
    return out;
  }

  if (el.recurrence_type === "weekly") {
    const dow = el.recurrence_day_of_week ?? 1;
    const days = eachCalendarDayInclusive(windowStart, windowEnd);
    for (const d of days) {
      const dt = new Date(`${d}T12:00:00.000Z`);
      if (dt.getUTCDay() !== dow) continue;
      const monday = mondayOfWeekUtc(dt);
      const wk = ymd(monday);
      out.push({
        restaurant_id: el.restaurant_id,
        element_id: el.id,
        period_key: `w:${wk}`,
        due_at: endOfUtcDayIso(d),
        risk_level: risk,
        status: "pending",
      });
    }
    return dedupeByPeriodKey(out);
  }

  if (el.recurrence_type === "monthly") {
    const dom = el.recurrence_day_of_month ?? 1;
    const months = monthsTouchingWindow(windowStart, windowEnd);
    for (const { y, m0 } of months) {
      const dim = daysInMonthUtc(y, m0);
      const day = Math.min(dom, dim);
      const d = new Date(Date.UTC(y, m0, day));
      if (d < stripTime(windowStart) || d > stripTime(windowEnd)) continue;
      const ds = ymd(d);
      out.push({
        restaurant_id: el.restaurant_id,
        element_id: el.id,
        period_key: `m:${yearMonth(d)}`,
        due_at: endOfUtcDayIso(ds),
        risk_level: risk,
        status: "pending",
      });
    }
    return dedupeByPeriodKey(out);
  }

  return out;
}

function stripTime(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function mondayOfWeekUtc(d: Date): Date {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function monthsTouchingWindow(start: Date, end: Date): { y: number; m0: number }[] {
  const out: { y: number; m0: number }[] = [];
  const cur = new Date(start);
  cur.setUTCDate(1);
  cur.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  while (cur <= last) {
    out.push({ y: cur.getUTCFullYear(), m0: cur.getUTCMonth() });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

function dedupeByPeriodKey(rows: TaskInsert[]): TaskInsert[] {
  const seen = new Set<string>();
  const out: TaskInsert[] = [];
  for (const r of rows) {
    const k = `${r.element_id}|${r.period_key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
