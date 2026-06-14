import type { HygieneElement, HygieneRecurrenceType } from "./types";
import { eachCalendarDayInclusive, endOfUtcDayIso, daysInMonthUtc, yearMonth, ymd } from "./dates";

type TaskInsert = {
  restaurant_id: string;
  element_id: string;
  period_key: string;
  due_at: string;
  risk_level: string;
  status: "pending";
  maintenance_plan: 0 | 1;
};

type PlanSpec = {
  recurrence_type: HygieneRecurrenceType;
  recurrence_day_of_week: number | null;
  recurrence_day_of_month: number | null;
  plan: 0 | 1;
};

export function buildTaskInsertsForElement(
  el: HygieneElement,
  windowStart: Date,
  windowEnd: Date,
  closedDays: number[] = []
): TaskInsert[] {
  const out: TaskInsert[] = [];
  const plans: PlanSpec[] = [
    {
      recurrence_type: el.recurrence_type,
      recurrence_day_of_week: el.recurrence_day_of_week,
      recurrence_day_of_month: el.recurrence_day_of_month,
      plan: 0,
    },
  ];

  if (el.secondary_recurrence_type) {
    plans.push({
      recurrence_type: el.secondary_recurrence_type,
      recurrence_day_of_week: el.secondary_recurrence_day_of_week,
      recurrence_day_of_month: el.secondary_recurrence_day_of_month,
      plan: 1,
    });
  }

  for (const spec of plans) {
    out.push(...buildForPlan(el, spec, windowStart, windowEnd, closedDays));
  }
  return out;
}

function buildForPlan(
  el: HygieneElement,
  spec: PlanSpec,
  windowStart: Date,
  windowEnd: Date,
  closedDays: number[]
): TaskInsert[] {
  const { recurrence_type, recurrence_day_of_week, recurrence_day_of_month, plan } = spec;
  const out: TaskInsert[] = [];
  const risk = el.risk_level;
  const planSuffix = plan === 1 ? ":p1" : "";

  if (recurrence_type === "after_each_service") return out;

  if (recurrence_type === "daily") {
    for (const d of eachCalendarDayInclusive(windowStart, windowEnd)) {
      if (isClosedDay(d, closedDays)) continue;
      out.push(row(el, `d:${d}${planSuffix}`, endOfUtcDayIso(d), risk, plan));
    }
    return out;
  }

  if (recurrence_type === "twice_a_week") {
    // Lundi (1) et jeudi (4)
    for (const d of eachCalendarDayInclusive(windowStart, windowEnd)) {
      if (isClosedDay(d, closedDays)) continue;
      const dt = new Date(`${d}T12:00:00.000Z`);
      const dow = dt.getUTCDay();
      if (dow !== 1 && dow !== 4) continue;
      const wk = ymd(mondayOfWeekUtc(dt));
      const slotKey = dow === 1 ? "a" : "b";
      out.push(row(el, `2w:${wk}:${slotKey}${planSuffix}`, endOfUtcDayIso(d), risk, plan));
    }
    return dedupeByPeriodKey(out);
  }

  if (recurrence_type === "three_times_a_week") {
    // Lundi (1), mercredi (3), vendredi (5)
    for (const d of eachCalendarDayInclusive(windowStart, windowEnd)) {
      if (isClosedDay(d, closedDays)) continue;
      const dt = new Date(`${d}T12:00:00.000Z`);
      const dow = dt.getUTCDay();
      if (dow !== 1 && dow !== 3 && dow !== 5) continue;
      const wk = ymd(mondayOfWeekUtc(dt));
      const slotKey = dow === 1 ? "a" : dow === 3 ? "b" : "c";
      out.push(row(el, `3w:${wk}:${slotKey}${planSuffix}`, endOfUtcDayIso(d), risk, plan));
    }
    return dedupeByPeriodKey(out);
  }

  if (recurrence_type === "weekly") {
    const dow = recurrence_day_of_week ?? 1;
    for (const d of eachCalendarDayInclusive(windowStart, windowEnd)) {
      const dt = new Date(`${d}T12:00:00.000Z`);
      if (dt.getUTCDay() !== dow) continue;
      if (isClosedDay(d, closedDays)) continue;
      const wk = ymd(mondayOfWeekUtc(dt));
      out.push(row(el, `w:${wk}${planSuffix}`, endOfUtcDayIso(d), risk, plan));
    }
    return dedupeByPeriodKey(out);
  }

  if (recurrence_type === "bimonthly") {
    // 1er et 15 de chaque mois
    for (const { y, m0 } of monthsTouchingWindow(windowStart, windowEnd)) {
      for (const dayOfMonth of [1, 15]) {
        const d = new Date(Date.UTC(y, m0, dayOfMonth));
        if (d < stripTime(windowStart) || d > stripTime(windowEnd)) continue;
        const ds = ymd(d);
        if (isClosedDay(ds, closedDays)) continue;
        const slot = dayOfMonth === 1 ? "a" : "b";
        out.push(row(el, `bm:${yearMonth(d)}:${slot}${planSuffix}`, endOfUtcDayIso(ds), risk, plan));
      }
    }
    return dedupeByPeriodKey(out);
  }

  if (recurrence_type === "monthly") {
    const dom = recurrence_day_of_month ?? 1;
    for (const { y, m0 } of monthsTouchingWindow(windowStart, windowEnd)) {
      const dim = daysInMonthUtc(y, m0);
      const day = Math.min(dom, dim);
      const d = new Date(Date.UTC(y, m0, day));
      if (d < stripTime(windowStart) || d > stripTime(windowEnd)) continue;
      const ds = ymd(d);
      if (isClosedDay(ds, closedDays)) continue;
      out.push(row(el, `m:${yearMonth(d)}${planSuffix}`, endOfUtcDayIso(ds), risk, plan));
    }
    return dedupeByPeriodKey(out);
  }

  if (recurrence_type === "quarterly") {
    const dom = recurrence_day_of_month ?? 1;
    // Génère une tâche par trimestre : Jan, Avr, Juil, Oct
    for (const { y, m0 } of monthsTouchingWindow(windowStart, windowEnd)) {
      if (m0 % 3 !== 0) continue;
      const dim = daysInMonthUtc(y, m0);
      const day = Math.min(dom, dim);
      const d = new Date(Date.UTC(y, m0, day));
      if (d < stripTime(windowStart) || d > stripTime(windowEnd)) continue;
      const ds = ymd(d);
      if (isClosedDay(ds, closedDays)) continue;
      const quarter = Math.floor(m0 / 3) + 1;
      out.push(row(el, `q:${y}:Q${quarter}${planSuffix}`, endOfUtcDayIso(ds), risk, plan));
    }
    return dedupeByPeriodKey(out);
  }

  if (recurrence_type === "annual") {
    const dom = recurrence_day_of_month ?? 1;
    // Génère une tâche au 1er janvier (ou dom) de chaque année dans la fenêtre
    const years = new Set<number>();
    const cur = new Date(windowStart);
    while (cur <= windowEnd) {
      years.add(cur.getUTCFullYear());
      cur.setUTCFullYear(cur.getUTCFullYear() + 1);
    }
    for (const y of years) {
      const dim = daysInMonthUtc(y, 0); // janvier
      const day = Math.min(dom, dim);
      const d = new Date(Date.UTC(y, 0, day));
      if (d < stripTime(windowStart) || d > stripTime(windowEnd)) continue;
      const ds = ymd(d);
      if (isClosedDay(ds, closedDays)) continue;
      out.push(row(el, `a:${y}${planSuffix}`, endOfUtcDayIso(ds), risk, plan));
    }
    return dedupeByPeriodKey(out);
  }

  return out;
}

function row(
  el: HygieneElement,
  period_key: string,
  due_at: string,
  risk_level: string,
  maintenance_plan: 0 | 1
): TaskInsert {
  return {
    restaurant_id: el.restaurant_id,
    element_id: el.id,
    period_key,
    due_at,
    risk_level,
    status: "pending",
    maintenance_plan,
  };
}

function isClosedDay(dayIso: string, closedDays: number[]): boolean {
  if (closedDays.length === 0) return false;
  const dow = new Date(`${dayIso}T12:00:00.000Z`).getUTCDay();
  return closedDays.includes(dow);
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
    const k = `${r.element_id}|${r.period_key}|${r.maintenance_plan}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
