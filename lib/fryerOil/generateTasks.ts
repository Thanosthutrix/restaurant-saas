import { eachCalendarDayInclusive, endOfUtcDayIso } from "@/lib/hygiene/dates";
import type { FryerUnit } from "./types";

type TaskInsert = {
  restaurant_id: string;
  fryer_unit_id: string;
  period_key: string;
  due_at: string;
  status: "pending";
};

/** Réutilise la logique HACCP températures (daily / per_service). */
export function buildFryerOilTaskInsertsForUnit(
  unit: FryerUnit,
  windowStart: Date,
  windowEnd: Date,
  closedDays: number[] = []
): TaskInsert[] {
  if (!unit.active) return [];

  const out: TaskInsert[] = [];
  const days = eachCalendarDayInclusive(windowStart, windowEnd);

  if (unit.recurrence_type === "daily") {
    for (const d of days) {
      if (isClosedDay(d, closedDays)) continue;
      out.push({
        restaurant_id: unit.restaurant_id,
        fryer_unit_id: unit.id,
        period_key: `d:${d}`,
        due_at: endOfUtcDayIso(d),
        status: "pending",
      });
    }
    return out;
  }

  for (const d of days) {
    if (isClosedDay(d, closedDays)) continue;
    out.push({
      restaurant_id: unit.restaurant_id,
      fryer_unit_id: unit.id,
      period_key: `ps:${d}:1`,
      due_at: `${d}T12:00:00.000Z`,
      status: "pending",
    });
    out.push({
      restaurant_id: unit.restaurant_id,
      fryer_unit_id: unit.id,
      period_key: `ps:${d}:2`,
      due_at: endOfUtcDayIso(d),
      status: "pending",
    });
  }
  return out;
}

function isClosedDay(dayIso: string, closedDays: number[]): boolean {
  if (closedDays.length === 0) return false;
  const dow = new Date(`${dayIso}T12:00:00.000Z`).getUTCDay();
  return closedDays.includes(dow);
}
