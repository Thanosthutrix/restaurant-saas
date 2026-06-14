import type { TemperaturePoint } from "./types";
import { eachCalendarDayInclusive, endOfUtcDayIso } from "@/lib/hygiene/dates";

type TaskInsert = {
  restaurant_id: string;
  temperature_point_id: string;
  period_key: string;
  due_at: string;
  status: "pending";
};

/**
 * Tâches à insérer pour un point actif sur [windowStart, windowEnd].
 * - daily : une tâche par jour calendaire (échéance fin de jour UTC).
 * - per_service : deux tâches par jour (midi 12:00 UTC, fin de jour UTC).
 */
export function buildTemperatureTaskInsertsForPoint(
  point: TemperaturePoint,
  windowStart: Date,
  windowEnd: Date,
  closedDays: number[] = []
): TaskInsert[] {
  if (!point.active) return [];

  const out: TaskInsert[] = [];
  const days = eachCalendarDayInclusive(windowStart, windowEnd);

  if (point.recurrence_type === "daily") {
    for (const d of days) {
      if (isClosedDay(d, closedDays)) continue;
      out.push({
        restaurant_id: point.restaurant_id,
        temperature_point_id: point.id,
        period_key: `d:${d}`,
        due_at: endOfUtcDayIso(d),
        status: "pending",
      });
    }
    return out;
  }

  if (point.recurrence_type === "per_service") {
    for (const d of days) {
      if (isClosedDay(d, closedDays)) continue;
      out.push({
        restaurant_id: point.restaurant_id,
        temperature_point_id: point.id,
        period_key: `ps:${d}:1`,
        due_at: `${d}T12:00:00.000Z`,
        status: "pending",
      });
      out.push({
        restaurant_id: point.restaurant_id,
        temperature_point_id: point.id,
        period_key: `ps:${d}:2`,
        due_at: endOfUtcDayIso(d),
        status: "pending",
      });
    }
    return out;
  }

  return out;
}

function isClosedDay(dayIso: string, closedDays: number[]): boolean {
  if (closedDays.length === 0) return false;
  const dow = new Date(`${dayIso}T12:00:00.000Z`).getUTCDay();
  return closedDays.includes(dow);
}
