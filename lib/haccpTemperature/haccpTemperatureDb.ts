import { supabaseServer } from "@/lib/supabaseServer";
import { buildTemperatureTaskInsertsForPoint } from "./generateTasks";
import type {
  TemperatureLog,
  TemperatureLogWithPoint,
  TemperaturePoint,
  TemperaturePointType,
  TemperatureRecurrenceType,
  TemperatureTask,
  TemperatureTaskWithPoint,
} from "./types";

function mapPoint(row: Record<string, unknown>): TemperaturePoint {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    name: String(row.name ?? ""),
    point_type: row.point_type as TemperaturePointType,
    location: String(row.location ?? ""),
    min_threshold: Number(row.min_threshold),
    max_threshold: Number(row.max_threshold),
    recurrence_type: row.recurrence_type as TemperatureRecurrenceType,
    active: Boolean(row.active),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapTask(row: Record<string, unknown>): TemperatureTask {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    temperature_point_id: String(row.temperature_point_id),
    period_key: String(row.period_key ?? ""),
    due_at: String(row.due_at ?? ""),
    status: row.status as TemperatureTask["status"],
    created_at: String(row.created_at ?? ""),
  };
}

function mapLog(row: Record<string, unknown>): TemperatureLog {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    temperature_point_id: String(row.temperature_point_id),
    task_id: row.task_id == null ? null : String(row.task_id),
    value: Number(row.value),
    log_status: row.log_status as TemperatureLog["log_status"],
    recorded_by_user_id: row.recorded_by_user_id == null ? null : String(row.recorded_by_user_id),
    recorded_by_display: row.recorded_by_display == null ? null : String(row.recorded_by_display),
    comment: row.comment == null ? null : String(row.comment),
    corrective_action: row.corrective_action == null ? null : String(row.corrective_action),
    product_impact: row.product_impact == null ? null : String(row.product_impact),
    created_at: String(row.created_at ?? ""),
  };
}

export async function listTemperaturePoints(restaurantId: string): Promise<TemperaturePoint[]> {
  const { data, error } = await supabaseServer
    .from("temperature_points")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapPoint);
}

export async function getTemperaturePoint(
  restaurantId: string,
  pointId: string
): Promise<TemperaturePoint | null> {
  const { data, error } = await supabaseServer
    .from("temperature_points")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", pointId)
    .maybeSingle();
  if (error || !data) return null;
  return mapPoint(data as Record<string, unknown>);
}

/** Génère les tâches manquantes sur une fenêtre (idempotent, ignore doublons). */
export async function ensureTemperatureTasksForRestaurant(
  restaurantId: string,
  daysAhead = 14
): Promise<void> {
  const { data: points, error } = await supabaseServer
    .from("temperature_points")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("active", true);
  if (error || !points?.length) return;

  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + daysAhead);

  for (const raw of points) {
    const point = mapPoint(raw as Record<string, unknown>);
    const rows = buildTemperatureTaskInsertsForPoint(point, windowStart, windowEnd);
    for (const row of rows) {
      const { error: insErr } = await supabaseServer.from("temperature_tasks").insert(row);
      if (insErr) {
        const code = (insErr as { code?: string }).code;
        if (code === "23505") continue;
      }
    }
  }
}

async function enrichTasksWithPoints(rows: Record<string, unknown>[]): Promise<TemperatureTaskWithPoint[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => String(r.temperature_point_id)))];
  const { data: pts } = await supabaseServer
    .from("temperature_points")
    .select("id, name, point_type, location, min_threshold, max_threshold")
    .in("id", ids);
  const byId = new Map(
    (pts ?? []).map((p) => {
      const x = p as {
        id: string;
        name: string;
        point_type: string;
        location: string;
        min_threshold: unknown;
        max_threshold: unknown;
      };
      return [x.id, x] as const;
    })
  );
  return rows.map((row) => {
    const t = mapTask(row);
    const p = byId.get(t.temperature_point_id);
    return {
      ...t,
      point_name: p?.name ?? "—",
      point_type: (p?.point_type ?? "cold_storage") as TemperaturePointType,
      location: p?.location ?? "",
      min_threshold: Number(p?.min_threshold ?? 0),
      max_threshold: Number(p?.max_threshold ?? 0),
    };
  });
}

/** Tâches en attente, les plus urgentes en premier. */
export async function listPendingTemperatureTasks(
  restaurantId: string,
  limit = 80
): Promise<TemperatureTaskWithPoint[]> {
  const { data, error } = await supabaseServer
    .from("temperature_tasks")
    .select(
      "id, restaurant_id, temperature_point_id, period_key, due_at, status, created_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return enrichTasksWithPoints(data as Record<string, unknown>[]);
}

export type TemperatureLogFilter = "all" | "anomalies";

export async function listTemperatureLogs(
  restaurantId: string,
  options: { limit?: number; filter?: TemperatureLogFilter }
): Promise<TemperatureLogWithPoint[]> {
  const limit = options.limit ?? 300;
  const base = supabaseServer
    .from("temperature_logs")
    .select(
      "id, restaurant_id, temperature_point_id, task_id, value, log_status, recorded_by_user_id, recorded_by_display, comment, corrective_action, product_impact, created_at"
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } =
    options.filter === "anomalies"
      ? await base.in("log_status", ["alert", "critical"])
      : await base;
  if (error || !data) return [];

  const ids = [...new Set((data as Record<string, unknown>[]).map((r) => String(r.temperature_point_id)))];
  const { data: pts } = await supabaseServer
    .from("temperature_points")
    .select("id, name, point_type")
    .in("id", ids);
  const byId = new Map(
    (pts ?? []).map((p) => {
      const x = p as { id: string; name: string; point_type: string };
      return [x.id, x] as const;
    })
  );

  return (data as Record<string, unknown>[]).map((row) => {
    const log = mapLog(row);
    const p = byId.get(log.temperature_point_id);
    return {
      ...log,
      point_name: p?.name ?? "—",
      point_type: (p?.point_type ?? "cold_storage") as TemperaturePointType,
    };
  });
}

export async function countPendingTemperatureTasks(restaurantId: string): Promise<number> {
  const { count, error } = await supabaseServer
    .from("temperature_tasks")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}
