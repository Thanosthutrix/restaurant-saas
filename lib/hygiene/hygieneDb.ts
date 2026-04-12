import { supabaseServer } from "@/lib/supabaseServer";
import { HYGIENE_PROOFS_BUCKET } from "@/lib/constants";
import type {
  HygieneColdEventKind,
  HygieneColdTemperatureReading,
  HygieneColdTemperatureReadingWithElement,
  HygieneElement,
  HygieneRecurrencePreset,
  HygieneRiskLevel,
  HygieneTask,
} from "./types";
import { HYGIENE_COLD_ELEMENT_CATEGORIES } from "./types";
import { buildTaskInsertsForElement } from "./generateTasks";
import { computeHygieneScore, type HygieneScoreTaskRow } from "./score";

export function getHygieneProofPublicUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  const { data } = supabaseServer.storage.from(HYGIENE_PROOFS_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function mapElement(row: Record<string, unknown>): HygieneElement {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    name: String(row.name ?? ""),
    category: String(row.category ?? "autre"),
    area_label: String(row.area_label ?? ""),
    description: row.description == null ? null : String(row.description),
    risk_level: row.risk_level as HygieneRiskLevel,
    recurrence_type: row.recurrence_type as HygieneElement["recurrence_type"],
    recurrence_day_of_week:
      row.recurrence_day_of_week == null ? null : Number(row.recurrence_day_of_week),
    recurrence_day_of_month:
      row.recurrence_day_of_month == null ? null : Number(row.recurrence_day_of_month),
    cleaning_protocol: String(row.cleaning_protocol ?? ""),
    disinfection_protocol: String(row.disinfection_protocol ?? ""),
    product_used: row.product_used == null ? null : String(row.product_used),
    dosage: row.dosage == null ? null : String(row.dosage),
    contact_time: row.contact_time == null ? null : String(row.contact_time),
    active: Boolean(row.active),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapTask(row: Record<string, unknown>): HygieneTask {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    element_id: String(row.element_id),
    period_key: String(row.period_key ?? ""),
    due_at: String(row.due_at ?? ""),
    risk_level: row.risk_level as HygieneRiskLevel,
    status: row.status as HygieneTask["status"],
    completed_at: row.completed_at == null ? null : String(row.completed_at),
    completed_by_user_id: row.completed_by_user_id == null ? null : String(row.completed_by_user_id),
    completed_by_display: row.completed_by_display == null ? null : String(row.completed_by_display),
    completed_by_initials:
      row.completed_by_initials == null || row.completed_by_initials === ""
        ? null
        : String(row.completed_by_initials),
    cleaning_action_type:
      row.cleaning_action_type == null || row.cleaning_action_type === ""
        ? null
        : (row.cleaning_action_type as HygieneTask["cleaning_action_type"]),
    completion_comment: row.completion_comment == null ? null : String(row.completion_comment),
    proof_photo_path: row.proof_photo_path == null ? null : String(row.proof_photo_path),
    created_at: String(row.created_at ?? ""),
  };
}

export async function listHygieneRecurrencePresets(): Promise<HygieneRecurrencePreset[]> {
  const { data, error } = await supabaseServer
    .from("hygiene_recurrence_presets")
    .select("category, default_recurrence_type, recurrence_day_of_week, recurrence_day_of_month, label_fr")
    .order("category");
  if (error || !data) return [];
  return (data as HygieneRecurrencePreset[]).map((r) => ({
    category: r.category,
    default_recurrence_type: r.default_recurrence_type,
    recurrence_day_of_week: r.recurrence_day_of_week,
    recurrence_day_of_month: r.recurrence_day_of_month,
    label_fr: r.label_fr,
  }));
}

export async function listHygieneElements(restaurantId: string): Promise<HygieneElement[]> {
  const { data, error } = await supabaseServer
    .from("hygiene_elements")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapElement);
}

export async function getHygieneElement(
  restaurantId: string,
  elementId: string
): Promise<HygieneElement | null> {
  const { data, error } = await supabaseServer
    .from("hygiene_elements")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", elementId)
    .maybeSingle();
  if (error || !data) return null;
  return mapElement(data as Record<string, unknown>);
}

export function isColdHygieneCategory(category: string): boolean {
  return (HYGIENE_COLD_ELEMENT_CATEGORIES as readonly string[]).includes(category);
}

/** Éléments actifs de type chambre froide / frigo / congélateur. */
export async function listColdHygieneElements(restaurantId: string): Promise<HygieneElement[]> {
  const all = await listHygieneElements(restaurantId);
  return all.filter((e) => e.active && isColdHygieneCategory(e.category));
}

function mapColdReading(row: Record<string, unknown>): HygieneColdTemperatureReading {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    element_id: String(row.element_id),
    event_kind: row.event_kind as HygieneColdEventKind,
    temperature_celsius: Number(row.temperature_celsius),
    recorded_at: String(row.recorded_at ?? ""),
    recorded_by_user_id: row.recorded_by_user_id == null ? null : String(row.recorded_by_user_id),
    recorded_by_display: row.recorded_by_display == null ? null : String(row.recorded_by_display),
    recorded_by_initials: row.recorded_by_initials == null ? null : String(row.recorded_by_initials),
    comment: row.comment == null ? null : String(row.comment),
  };
}

async function enrichColdReadingsWithElements(
  rows: Record<string, unknown>[]
): Promise<HygieneColdTemperatureReadingWithElement[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => String(r.element_id)))];
  const { data: els } = await supabaseServer
    .from("hygiene_elements")
    .select("id, name, category, area_label")
    .in("id", ids);
  const byId = new Map(
    (els ?? []).map((e) => {
      const x = e as { id: string; name: string; category: string; area_label: string };
      return [x.id, x] as const;
    })
  );
  return rows.map((row) => {
    const r = mapColdReading(row);
    const el = byId.get(r.element_id);
    return {
      ...r,
      element_name: el?.name ?? "—",
      element_category: el?.category ?? "",
      area_label: el?.area_label ?? "",
    };
  });
}

/** Registre des relevés froids (plus récent en premier). */
export async function listColdTemperatureRegister(
  restaurantId: string,
  limit = 200
): Promise<HygieneColdTemperatureReadingWithElement[]> {
  const { data, error } = await supabaseServer
    .from("hygiene_cold_temperature_readings")
    .select(
      "id, restaurant_id, element_id, event_kind, temperature_celsius, recorded_at, recorded_by_user_id, recorded_by_display, recorded_by_initials, comment"
    )
    .eq("restaurant_id", restaurantId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return enrichColdReadingsWithElements(data as Record<string, unknown>[]);
}

/** Génère les occurrences manquantes sur une fenêtre (idempotent). */
export async function ensureHygieneTasksForRestaurant(
  restaurantId: string,
  daysAhead = 14
): Promise<void> {
  const { data: elements, error } = await supabaseServer
    .from("hygiene_elements")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("active", true);
  if (error || !elements?.length) return;

  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + daysAhead);

  for (const raw of elements) {
    const el = mapElement(raw as Record<string, unknown>);
    const rows = buildTaskInsertsForElement(el, windowStart, windowEnd);
    for (const row of rows) {
      const { error: insErr } = await supabaseServer.from("hygiene_tasks").insert(row);
      if (insErr) {
        const code = (insErr as { code?: string }).code;
        if (code === "23505") continue;
      }
    }
  }
}

export type HygieneTaskWithElement = HygieneTask & {
  element_name: string;
  element_category: string;
  area_label: string;
};

async function enrichTasksWithElements(
  rows: Record<string, unknown>[]
): Promise<HygieneTaskWithElement[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => String(r.element_id)))];
  const { data: els } = await supabaseServer
    .from("hygiene_elements")
    .select("id, name, category, area_label")
    .in("id", ids);
  const byId = new Map(
    (els ?? []).map((e) => {
      const x = e as { id: string; name: string; category: string; area_label: string };
      return [x.id, x] as const;
    })
  );
  return rows.map((row) => {
    const t = mapTask(row);
    const el = byId.get(t.element_id);
    return {
      ...t,
      element_name: el?.name ?? "—",
      element_category: el?.category ?? "",
      area_label: el?.area_label ?? "",
    };
  });
}

export async function countHygieneTasksDue(restaurantId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const { count, error } = await supabaseServer
    .from("hygiene_tasks")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .lte("due_at", nowIso);
  if (error) return 0;
  return count ?? 0;
}

export async function listHygieneTasksDue(
  restaurantId: string,
  limit = 80
): Promise<HygieneTaskWithElement[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("hygiene_tasks")
    .select(
      "id, restaurant_id, element_id, period_key, due_at, risk_level, status, completed_at, completed_by_user_id, completed_by_display, completed_by_initials, cleaning_action_type, completion_comment, proof_photo_path, created_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return enrichTasksWithElements(data as Record<string, unknown>[]);
}

export async function listHygieneTasksUpcoming(
  restaurantId: string,
  limit = 40
): Promise<HygieneTaskWithElement[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from("hygiene_tasks")
    .select(
      "id, restaurant_id, element_id, period_key, due_at, risk_level, status, completed_at, completed_by_user_id, completed_by_display, completed_by_initials, cleaning_action_type, completion_comment, proof_photo_path, created_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .gt("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return enrichTasksWithElements(data as Record<string, unknown>[]);
}

export async function listHygieneRegister(
  restaurantId: string,
  limit = 200
): Promise<HygieneTaskWithElement[]> {
  const { data, error } = await supabaseServer
    .from("hygiene_tasks")
    .select(
      "id, restaurant_id, element_id, period_key, due_at, risk_level, status, completed_at, completed_by_user_id, completed_by_display, completed_by_initials, cleaning_action_type, completion_comment, proof_photo_path, created_at"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return enrichTasksWithElements(data as Record<string, unknown>[]);
}

export async function getHygieneScoreForRestaurant(
  restaurantId: string,
  windowDays = 7
): Promise<{ score: number; earned: number; max: number; detail: string }> {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - windowDays);
  start.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabaseServer
    .from("hygiene_tasks")
    .select("risk_level, status, due_at, completed_at")
    .eq("restaurant_id", restaurantId)
    .gte("due_at", start.toISOString())
    .lte("due_at", now.toISOString());

  if (error || !data) {
    return { score: 100, earned: 0, max: 0, detail: "Aucune donnée." };
  }

  const rows: HygieneScoreTaskRow[] = (data as Record<string, unknown>[]).map((r) => ({
    risk_level: r.risk_level as HygieneScoreTaskRow["risk_level"],
    status: r.status as HygieneScoreTaskRow["status"],
    due_at: String(r.due_at ?? ""),
    completed_at: r.completed_at == null ? null : String(r.completed_at),
  }));

  return computeHygieneScore(rows, now);
}
