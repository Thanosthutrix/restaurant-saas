"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
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
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Le nom est obligatoire." };

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
  };

  if (payload.id) {
    const { error } = await supabaseServer
      .from("hygiene_elements")
      .update(row)
      .eq("id", payload.id)
      .eq("restaurant_id", restaurantId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabaseServer.from("hygiene_elements").insert(row);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/hygiene");
  revalidatePath("/hygiene/elements");
  revalidatePath("/hygiene/a-faire");
  return { ok: true };
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
  revalidatePath("/hygiene/elements");
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
