import { supabaseServer } from "@/lib/supabaseServer";
import { buildFryerOilTaskInsertsForUnit } from "./generateTasks";
import type {
  FryerOilBatch,
  FryerOilLog,
  FryerOilLogWithUnit,
  FryerOilTask,
  FryerOilTaskWithUnit,
  FryerRecurrenceType,
  FryerUnit,
  OilBatchEndReason,
  TpmTestMethod,
} from "./types";

function mapUnit(row: Record<string, unknown>): FryerUnit {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    name: String(row.name ?? ""),
    location: String(row.location ?? ""),
    capacity_liters: row.capacity_liters != null ? Number(row.capacity_liters) : null,
    oil_temp_min_celsius: Number(row.oil_temp_min_celsius),
    oil_temp_max_celsius: Number(row.oil_temp_max_celsius),
    tpm_alert_threshold_pct: Number(row.tpm_alert_threshold_pct),
    tpm_change_threshold_pct: Number(row.tpm_change_threshold_pct),
    recurrence_type: row.recurrence_type as FryerRecurrenceType,
    active: Boolean(row.active),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapBatch(row: Record<string, unknown>): FryerOilBatch {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    fryer_unit_id: String(row.fryer_unit_id),
    started_at: String(row.started_at ?? ""),
    ended_at: row.ended_at == null ? null : String(row.ended_at),
    end_reason: row.end_reason == null ? null : (row.end_reason as OilBatchEndReason),
    oil_product_name: row.oil_product_name == null ? null : String(row.oil_product_name),
    initial_volume_liters:
      row.initial_volume_liters != null ? Number(row.initial_volume_liters) : null,
    recorded_by_display:
      row.recorded_by_display == null ? null : String(row.recorded_by_display),
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at ?? ""),
  };
}

function mapLog(row: Record<string, unknown>): FryerOilLog {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    fryer_unit_id: String(row.fryer_unit_id),
    oil_batch_id: row.oil_batch_id == null ? null : String(row.oil_batch_id),
    task_id: row.task_id == null ? null : String(row.task_id),
    tpm_percent: row.tpm_percent != null ? Number(row.tpm_percent) : null,
    tpm_test_method: row.tpm_test_method as TpmTestMethod,
    oil_temperature_celsius: Number(row.oil_temperature_celsius),
    filtration_done: Boolean(row.filtration_done),
    quality_ok: Boolean(row.quality_ok),
    quality_issues: row.quality_issues == null ? null : String(row.quality_issues),
    log_status: row.log_status as FryerOilLog["log_status"],
    change_oil_required: Boolean(row.change_oil_required),
    oil_changed: Boolean(row.oil_changed),
    recorded_by_user_id:
      row.recorded_by_user_id == null ? null : String(row.recorded_by_user_id),
    recorded_by_display:
      row.recorded_by_display == null ? null : String(row.recorded_by_display),
    comment: row.comment == null ? null : String(row.comment),
    corrective_action: row.corrective_action == null ? null : String(row.corrective_action),
    created_at: String(row.created_at ?? ""),
  };
}

export async function listFryerUnits(restaurantId: string): Promise<FryerUnit[]> {
  const { data, error } = await supabaseServer
    .from("fryer_units")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapUnit);
}

export async function getFryerUnit(
  restaurantId: string,
  unitId: string
): Promise<FryerUnit | null> {
  const { data, error } = await supabaseServer
    .from("fryer_units")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", unitId)
    .maybeSingle();
  if (error || !data) return null;
  return mapUnit(data as Record<string, unknown>);
}

export async function getActiveOilBatch(
  restaurantId: string,
  fryerUnitId: string
): Promise<FryerOilBatch | null> {
  const { data, error } = await supabaseServer
    .from("fryer_oil_batches")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("fryer_unit_id", fryerUnitId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapBatch(data as Record<string, unknown>);
}

export async function ensureFryerOilTasksForRestaurant(
  restaurantId: string,
  daysAhead = 14
): Promise<void> {
  const [unitsRes, restaurantRes] = await Promise.all([
    supabaseServer
      .from("fryer_units")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("active", true),
    supabaseServer
      .from("restaurants")
      .select("closed_days_of_week")
      .eq("id", restaurantId)
      .maybeSingle(),
  ]);

  const units = unitsRes.data;
  if (unitsRes.error || !units?.length) return;

  const closedDays: number[] =
    (restaurantRes.data as { closed_days_of_week?: number[] } | null)?.closed_days_of_week ?? [];

  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + daysAhead);

  const rowsToInsert = [];
  for (const raw of units) {
    const unit = mapUnit(raw as Record<string, unknown>);
    rowsToInsert.push(...buildFryerOilTaskInsertsForUnit(unit, windowStart, windowEnd, closedDays));
  }
  if (rowsToInsert.length === 0) return;

  const chunkSize = 500;
  for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
    await supabaseServer.from("fryer_oil_tasks").upsert(rowsToInsert.slice(i, i + chunkSize), {
      onConflict: "fryer_unit_id,period_key",
      ignoreDuplicates: true,
    });
  }
}

async function enrichTasksWithUnits(
  rows: Record<string, unknown>[]
): Promise<FryerOilTaskWithUnit[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => String(r.fryer_unit_id)))];
  const { data: units } = await supabaseServer
    .from("fryer_units")
    .select(
      "id, name, location, oil_temp_min_celsius, oil_temp_max_celsius, tpm_alert_threshold_pct, tpm_change_threshold_pct"
    )
    .in("id", ids);
  const byId = new Map((units ?? []).map((u) => [String((u as { id: string }).id), u as Record<string, unknown>]));

  return rows.map((row) => {
    const t = row as FryerOilTask;
    const u = byId.get(String(row.fryer_unit_id));
    return {
      id: String(row.id),
      restaurant_id: String(row.restaurant_id),
      fryer_unit_id: String(row.fryer_unit_id),
      period_key: String(row.period_key),
      due_at: String(row.due_at),
      status: row.status as FryerOilTask["status"],
      created_at: String(row.created_at ?? ""),
      unit_name: String(u?.name ?? "—"),
      location: String(u?.location ?? ""),
      oil_temp_min_celsius: Number(u?.oil_temp_min_celsius ?? 160),
      oil_temp_max_celsius: Number(u?.oil_temp_max_celsius ?? 190),
      tpm_alert_threshold_pct: Number(u?.tpm_alert_threshold_pct ?? 22),
      tpm_change_threshold_pct: Number(u?.tpm_change_threshold_pct ?? 25),
    };
  });
}

export async function listPendingFryerOilTasks(
  restaurantId: string,
  limit = 80
): Promise<FryerOilTaskWithUnit[]> {
  const { data, error } = await supabaseServer
    .from("fryer_oil_tasks")
    .select("id, restaurant_id, fryer_unit_id, period_key, due_at, status, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return enrichTasksWithUnits(data as Record<string, unknown>[]);
}

export async function countPendingFryerOilTasks(restaurantId: string): Promise<number> {
  const { count, error } = await supabaseServer
    .from("fryer_oil_tasks")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

export type FryerOilLogFilter = "all" | "anomalies";

export async function listFryerOilLogs(
  restaurantId: string,
  options: { limit?: number; filter?: FryerOilLogFilter }
): Promise<FryerOilLogWithUnit[]> {
  const limit = options.limit ?? 300;
  const base = supabaseServer
    .from("fryer_oil_logs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } =
    options.filter === "anomalies"
      ? await base.in("log_status", ["alert", "critical"])
      : await base;

  if (error || !data) return [];

  const ids = [...new Set((data as Record<string, unknown>[]).map((r) => String(r.fryer_unit_id)))];
  const { data: units } = await supabaseServer.from("fryer_units").select("id, name").in("id", ids);
  const byId = new Map((units ?? []).map((u) => [String((u as { id: string }).id), String((u as { name: string }).name)]));

  return (data as Record<string, unknown>[]).map((row) => ({
    ...mapLog(row),
    unit_name: byId.get(String(row.fryer_unit_id)) ?? "—",
  }));
}

export async function ensureActiveOilBatch(
  restaurantId: string,
  fryerUnitId: string,
  recordedByDisplay: string
): Promise<FryerOilBatch> {
  const existing = await getActiveOilBatch(restaurantId, fryerUnitId);
  if (existing) return existing;

  const { data, error } = await supabaseServer
    .from("fryer_oil_batches")
    .insert({
      restaurant_id: restaurantId,
      fryer_unit_id: fryerUnitId,
      recorded_by_display: recordedByDisplay,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Impossible de créer la charge d'huile.");
  return mapBatch(data as Record<string, unknown>);
}

export async function endOilBatch(params: {
  batchId: string;
  restaurantId: string;
  endReason: OilBatchEndReason;
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabaseServer
    .from("fryer_oil_batches")
    .update({
      ended_at: new Date().toISOString(),
      end_reason: params.endReason,
      notes: params.notes?.trim() || null,
    })
    .eq("id", params.batchId)
    .eq("restaurant_id", params.restaurantId)
    .is("ended_at", null);

  if (error) throw new Error(error.message);
}

export async function startOilBatch(params: {
  restaurantId: string;
  fryerUnitId: string;
  oilProductName?: string | null;
  initialVolumeLiters?: number | null;
  recordedByDisplay: string;
  notes?: string | null;
}): Promise<FryerOilBatch> {
  const { data, error } = await supabaseServer
    .from("fryer_oil_batches")
    .insert({
      restaurant_id: params.restaurantId,
      fryer_unit_id: params.fryerUnitId,
      oil_product_name: params.oilProductName?.trim() || null,
      initial_volume_liters: params.initialVolumeLiters ?? null,
      recorded_by_display: params.recordedByDisplay,
      notes: params.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Impossible de démarrer une nouvelle charge.");
  return mapBatch(data as Record<string, unknown>);
}
