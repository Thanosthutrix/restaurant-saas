"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { invalidateHygieneElementsCache, invalidateTemperaturePointsCache } from "@/lib/cacheInvalidation";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureHygieneTasksForRestaurant,
  getHygieneElement,
  isColdHygieneCategory,
} from "@/lib/hygiene/hygieneDb";
import type {
  HygieneCleaningActionType,
  HygieneRecurrenceType,
  HygieneRiskLevel,
} from "@/lib/hygiene/types";
import { HYGIENE_CLEANING_ACTION_TYPES, HYGIENE_COLD_EVENT_KINDS } from "@/lib/hygiene/types";
import { endOfUtcDayIso } from "@/lib/hygiene/dates";

function parseHygieneCompletionDetails(
  cleaningActionTypeRaw: string,
  initialsRaw: string
):
  | { ok: true; cleaning_action_type: HygieneCleaningActionType; completed_by_initials: string }
  | { ok: false; error: string } {
  const t = initialsRaw.trim().toUpperCase().replace(/\s+/g, " ");
  if (t.length < 2) {
    return { ok: false, error: "Indiquez au moins 2 caractères pour les initiales." };
  }
  if (t.length > 16) {
    return { ok: false, error: "Initiales trop longues (16 caractères max)." };
  }
  if (!(HYGIENE_CLEANING_ACTION_TYPES as readonly string[]).includes(cleaningActionTypeRaw)) {
    return { ok: false, error: "Type d’intervention invalide." };
  }
  return {
    ok: true,
    cleaning_action_type: cleaningActionTypeRaw as HygieneCleaningActionType,
    completed_by_initials: t,
  };
}

function parseTemperatureCelsius(
  raw: string
): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim().replace(",", ".").replace(/\s+/g, "");
  if (s === "") return { ok: false, error: "Indiquez la température en °C." };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, error: "Température invalide." };
  if (n < -40 || n > 25) return { ok: false, error: "Température hors plage (-40 °C à +25 °C)." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

function parseOptionalColdInitials(
  raw: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  const t = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (t.length === 0) return { ok: true, value: null };
  if (t.length < 2) return { ok: false, error: "Initiales : au moins 2 caractères, ou laissez vide." };
  if (t.length > 16) return { ok: false, error: "Initiales trop longues." };
  return { ok: true, value: t };
}

function displayFromUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const meta = user.user_metadata;
  const full =
    meta && typeof meta.full_name === "string"
      ? meta.full_name.trim()
      : typeof meta?.name === "string"
        ? String(meta.name).trim()
        : "";
  if (full) return full.slice(0, 80);
  const email = user.email ?? "";
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 48) || "Utilisateur";
}

export async function ensureHygieneTasksAction(restaurantId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return;

  await ensureHygieneTasksForRestaurant(restaurantId, 14);
  revalidatePath("/hygiene");
  revalidatePath("/hygiene/a-faire");
}

/** Catégories "froid" dont le type de point HACCP correspondant. */
const COLD_CATEGORY_POINT_TYPE: Record<string, string> = {
  chambre_froide: "cold_storage",
  frigo: "cold_storage",
  congelateur: "freezer",
};

export async function upsertHygieneElementAction(
  restaurantId: string,
  payload: {
    id?: string | null;
    name: string;
    category: string;
    area_label: string;
    description: string | null;
    risk_level: HygieneRiskLevel;
    recurrence_type: HygieneRecurrenceType;
    recurrence_day_of_week: number | null;
    recurrence_day_of_month: number | null;
    cleaning_protocol: string;
    disinfection_protocol: string;
    product_used: string | null;
    dosage: string | null;
    contact_time: string | null;
    active: boolean;
    temp_point_enabled: boolean;
    temp_min_threshold: number | null;
    temp_max_threshold: number | null;
    temp_recurrence_type: "daily" | "per_service" | null;
    secondary_recurrence_type: HygieneRecurrenceType | null;
    secondary_recurrence_day_of_week: number | null;
    secondary_recurrence_day_of_month: number | null;
    secondary_cleaning_protocol: string;
    secondary_disinfection_protocol: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Le nom est obligatoire." };

  const isCold = payload.category in COLD_CATEGORY_POINT_TYPE;
  const tempEnabled = isCold && payload.temp_point_enabled;

  if (tempEnabled) {
    const min = payload.temp_min_threshold;
    const max = payload.temp_max_threshold;
    if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) {
      return { ok: false, error: "Renseignez les seuils de température (min et max)." };
    }
    if (min >= max) {
      return { ok: false, error: "Le seuil minimum doit être inférieur au maximum." };
    }
  }

  const row = {
    restaurant_id: restaurantId,
    name,
    category: payload.category,
    area_label: payload.area_label.trim(),
    description: payload.description?.trim() || null,
    risk_level: payload.risk_level,
    recurrence_type: payload.recurrence_type,
    recurrence_day_of_week: payload.recurrence_day_of_week,
    recurrence_day_of_month: payload.recurrence_day_of_month,
    cleaning_protocol: payload.cleaning_protocol.trim(),
    disinfection_protocol: payload.disinfection_protocol.trim(),
    product_used: payload.product_used?.trim() || null,
    dosage: payload.dosage?.trim() || null,
    contact_time: payload.contact_time?.trim() || null,
    active: payload.active,
    temp_point_enabled: tempEnabled,
    temp_min_threshold: tempEnabled ? payload.temp_min_threshold : null,
    temp_max_threshold: tempEnabled ? payload.temp_max_threshold : null,
    temp_recurrence_type: tempEnabled ? (payload.temp_recurrence_type ?? "daily") : null,
    secondary_recurrence_type: payload.secondary_recurrence_type || null,
    secondary_recurrence_day_of_week: payload.secondary_recurrence_type === "weekly" ? payload.secondary_recurrence_day_of_week : null,
    secondary_recurrence_day_of_month: payload.secondary_recurrence_type && ["monthly", "quarterly", "annual"].includes(payload.secondary_recurrence_type) ? payload.secondary_recurrence_day_of_month : null,
    secondary_cleaning_protocol: payload.secondary_cleaning_protocol.trim(),
    secondary_disinfection_protocol: payload.secondary_disinfection_protocol.trim(),
  };

  let elementId: string;
  if (payload.id) {
    const { error } = await supabaseServer
      .from("hygiene_elements")
      .update(row)
      .eq("id", payload.id)
      .eq("restaurant_id", restaurantId);
    if (error) return { ok: false, error: error.message };
    elementId = payload.id;
  } else {
    const { data, error } = await supabaseServer
      .from("hygiene_elements")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: error?.message ?? "Erreur à la création." };
    elementId = (data as { id: string }).id;
  }

  // Synchroniser le temperature_point lié
  await syncTemperaturePointForElement(restaurantId, elementId, payload.category, {
    enabled: tempEnabled,
    active: payload.active,
    name,
    location: payload.area_label.trim(),
    min_threshold: payload.temp_min_threshold,
    max_threshold: payload.temp_max_threshold,
    recurrence_type: payload.temp_recurrence_type ?? "daily",
  });

  revalidatePath("/hygiene");
  revalidatePath("/hygiene/elements");
  revalidatePath("/hygiene/a-faire");
  revalidatePath("/dashboard");
  return { ok: true };
}

async function syncTemperaturePointForElement(
  restaurantId: string,
  elementId: string,
  category: string,
  opts: {
    enabled: boolean;
    active: boolean;
    name: string;
    location: string;
    min_threshold: number | null;
    max_threshold: number | null;
    recurrence_type: "daily" | "per_service";
  }
): Promise<void> {
  // Chercher un temperature_point déjà lié à cet élément
  const { data: existing } = await supabaseServer
    .from("temperature_points")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("hygiene_element_id", elementId)
    .maybeSingle();

  const linkedId = existing ? (existing as { id: string }).id : null;

  if (!opts.enabled) {
    // Désactiver le point lié s'il existe
    if (linkedId) {
      await supabaseServer
        .from("temperature_points")
        .update({ active: false })
        .eq("id", linkedId);
    }
    return;
  }

  const pointType = COLD_CATEGORY_POINT_TYPE[category] ?? "cold_storage";
  const pointRow = {
    restaurant_id: restaurantId,
    name: opts.name,
    point_type: pointType,
    location: opts.location,
    min_threshold: opts.min_threshold!,
    max_threshold: opts.max_threshold!,
    recurrence_type: opts.recurrence_type,
    active: opts.active,
    hygiene_element_id: elementId,
  };

  if (linkedId) {
    await supabaseServer
      .from("temperature_points")
      .update(pointRow)
      .eq("id", linkedId);
  } else {
    await supabaseServer.from("temperature_points").insert(pointRow);
  }
}

export async function setHygieneElementActiveAction(
  restaurantId: string,
  elementId: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("hygiene_elements")
    .update({ active })
    .eq("id", elementId)
    .eq("restaurant_id", restaurantId);
  if (error) return { ok: false, error: error.message };

  // Propager l'activation/désactivation au temperature_point lié
  await supabaseServer
    .from("temperature_points")
    .update({ active })
    .eq("hygiene_element_id", elementId)
    .eq("restaurant_id", restaurantId);

  revalidatePath("/hygiene/elements");
  revalidatePath("/dashboard");
  invalidateHygieneElementsCache();
  invalidateTemperaturePointsCache();
  return { ok: true };
}

export async function deleteHygieneElementAction(
  restaurantId: string,
  elementId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("hygiene_elements")
    .delete()
    .eq("id", elementId)
    .eq("restaurant_id", restaurantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hygiene/elements");
  revalidatePath("/hygiene/a-faire");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Tâche ponctuelle (après service, etc.). */
export async function createManualHygieneTaskAction(
  restaurantId: string,
  elementId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const el = await getHygieneElement(restaurantId, elementId);
  if (!el || !el.active) return { ok: false, error: "Élément introuvable." };

  const period_key = `manual:${randomUUID()}`;
  const ymd = new Date().toISOString().slice(0, 10);
  const due_at = endOfUtcDayIso(ymd);

  const { error } = await supabaseServer.from("hygiene_tasks").insert({
    restaurant_id: restaurantId,
    element_id: elementId,
    period_key,
    due_at,
    risk_level: el.risk_level,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hygiene/a-faire");
  return { ok: true };
}

/**
 * Enregistrement direct depuis la liste des éléments : passage au registre tout de suite
 * (qui, quand, commentaire et photo de preuve optionnelle).
 */
export async function logHygieneElementDoneAction(
  restaurantId: string,
  elementId: string,
  params: {
    comment: string | null;
    proofPhotoPath: string | null;
    cleaningActionType: string;
    initials: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const parsed = parseHygieneCompletionDetails(params.cleaningActionType, params.initials);
  if (!parsed.ok) return parsed;

  const el = await getHygieneElement(restaurantId, elementId);
  if (!el) return { ok: false, error: "Élément introuvable." };

  const now = new Date().toISOString();
  const display = displayFromUser(user);

  const { error } = await supabaseServer.from("hygiene_tasks").insert({
    restaurant_id: restaurantId,
    element_id: elementId,
    period_key: `direct:${randomUUID()}`,
    due_at: now,
    risk_level: el.risk_level,
    status: "completed",
    completed_at: now,
    completed_by_user_id: user.id,
    completed_by_display: display,
    cleaning_action_type: parsed.cleaning_action_type,
    completed_by_initials: parsed.completed_by_initials,
    completion_comment: params.comment?.trim() || null,
    proof_photo_path: params.proofPhotoPath?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hygiene");
  revalidatePath("/hygiene/elements");
  revalidatePath("/hygiene/registre");
  revalidatePath("/hygiene/a-faire");
  return { ok: true };
}

export async function completeHygieneTaskAction(
  restaurantId: string,
  taskId: string,
  params: {
    comment: string | null;
    proofPhotoPath: string | null;
    cleaningActionType: string;
    initials: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const parsed = parseHygieneCompletionDetails(params.cleaningActionType, params.initials);
  if (!parsed.ok) return parsed;

  const { data: task, error: fetchErr } = await supabaseServer
    .from("hygiene_tasks")
    .select("id, restaurant_id, element_id, risk_level, status, due_at")
    .eq("id", taskId)
    .maybeSingle();

  if (fetchErr || !task) return { ok: false, error: "Tâche introuvable." };
  const t = task as {
    id: string;
    restaurant_id: string;
    risk_level: string;
    status: string;
  };
  if (t.restaurant_id !== restaurantId) return { ok: false, error: "Non autorisé." };
  if (t.status !== "pending") return { ok: false, error: "Tâche déjà traitée." };

  if (t.risk_level === "critical" && !params.proofPhotoPath?.trim()) {
    return { ok: false, error: "Une photo de preuve est obligatoire pour les tâches critiques." };
  }

  const display = displayFromUser(user);

  const { error: updErr } = await supabaseServer
    .from("hygiene_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by_user_id: user.id,
      completed_by_display: display,
      cleaning_action_type: parsed.cleaning_action_type,
      completed_by_initials: parsed.completed_by_initials,
      completion_comment: params.comment?.trim() || null,
      proof_photo_path: params.proofPhotoPath?.trim() || null,
    })
    .eq("id", taskId)
    .eq("restaurant_id", restaurantId);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/hygiene");
  revalidatePath("/hygiene/a-faire");
  revalidatePath("/hygiene/registre");
  return { ok: true };
}

/** Relevé °C à l’ouverture ou à la fermeture d’un équipement froid (registre dédié). */
export async function logColdTemperatureReadingAction(
  restaurantId: string,
  elementId: string,
  params: {
    eventKind: string;
    temperatureCelsiusRaw: string;
    initials: string;
    comment: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  if (!(HYGIENE_COLD_EVENT_KINDS as readonly string[]).includes(params.eventKind)) {
    return { ok: false, error: "Type de relevé invalide (ouverture ou fermeture)." };
  }

  const el = await getHygieneElement(restaurantId, elementId);
  if (!el || !el.active) return { ok: false, error: "Élément introuvable." };
  if (!isColdHygieneCategory(el.category)) {
    return {
      ok: false,
      error: "Ce relevé concerne uniquement les chambres froides, frigos et congélateurs.",
    };
  }

  const temp = parseTemperatureCelsius(params.temperatureCelsiusRaw);
  if (!temp.ok) return temp;

  const ini = parseOptionalColdInitials(params.initials);
  if (!ini.ok) return ini;

  const display = displayFromUser(user);

  const { error } = await supabaseServer.from("hygiene_cold_temperature_readings").insert({
    restaurant_id: restaurantId,
    element_id: elementId,
    event_kind: params.eventKind,
    temperature_celsius: temp.value,
    recorded_by_user_id: user.id,
    recorded_by_display: display,
    recorded_by_initials: ini.value,
    comment: params.comment?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/hygiene");
  revalidatePath("/hygiene/temperatures-ouverture");
  revalidatePath("/hygiene/registre-temperatures");
  return { ok: true };
}
