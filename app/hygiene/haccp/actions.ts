"use server";

import { revalidatePath } from "next/cache";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { getCurrentUser } from "@/lib/auth";
import { getTemperaturePoint } from "@/lib/haccpTemperature/haccpTemperatureDb";
import {
  classifyTemperatureStatus,
  parseTemperatureInput,
  requiresCorrectiveFields,
} from "@/lib/haccpTemperature/rules";
import type { TemperaturePointType, TemperatureRecurrenceType } from "@/lib/haccpTemperature/types";
import { TEMPERATURE_POINT_TYPES, TEMPERATURE_RECURRENCE_TYPES } from "@/lib/haccpTemperature/types";
import { supabaseServer } from "@/lib/supabaseServer";

function displayFromUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
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

export async function upsertTemperaturePointAction(
  restaurantId: string,
  payload: {
    id?: string | null;
    name: string;
    point_type: string;
    location: string;
    min_threshold: number;
    max_threshold: number;
    recurrence_type: string;
    active: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const name = payload.name.trim();
  if (!name) return { ok: false, error: "Le nom est obligatoire." };

  if (!(TEMPERATURE_POINT_TYPES as readonly string[]).includes(payload.point_type)) {
    return { ok: false, error: "Type de point invalide." };
  }
  if (!(TEMPERATURE_RECURRENCE_TYPES as readonly string[]).includes(payload.recurrence_type)) {
    return { ok: false, error: "Récurrence invalide." };
  }

  const min = Number(payload.min_threshold);
  const max = Number(payload.max_threshold);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { ok: false, error: "Seuils invalides." };
  if (min >= max) return { ok: false, error: "Le minimum doit être strictement inférieur au maximum." };

  const row = {
    restaurant_id: restaurantId,
    name,
    point_type: payload.point_type as TemperaturePointType,
    location: payload.location.trim(),
    min_threshold: min,
    max_threshold: max,
    recurrence_type: payload.recurrence_type as TemperatureRecurrenceType,
    active: payload.active,
  };

  if (payload.id) {
    const existing = await getTemperaturePoint(restaurantId, payload.id);
    if (!existing) return { ok: false, error: "Point introuvable." };
    const { error } = await supabaseServer.from("temperature_points").update(row).eq("id", payload.id).eq("restaurant_id", restaurantId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabaseServer.from("temperature_points").insert(row);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/hygiene/haccp");
  revalidatePath("/hygiene/haccp/points");
  revalidatePath("/hygiene/haccp/check");
  return { ok: true };
}

export async function setTemperaturePointActiveAction(
  restaurantId: string,
  pointId: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("temperature_points")
    .update({ active })
    .eq("id", pointId)
    .eq("restaurant_id", restaurantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hygiene/haccp/points");
  revalidatePath("/hygiene/haccp/check");
  return { ok: true };
}

export async function submitTemperatureLogAction(
  restaurantId: string,
  taskId: string,
  params: {
    temperatureRaw: string;
    comment: string | null;
    correctiveAction: string | null;
    productImpact: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const { data: taskRow, error: taskErr } = await supabaseServer
    .from("temperature_tasks")
    .select("id, restaurant_id, temperature_point_id, status")
    .eq("id", taskId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (taskErr || !taskRow) return { ok: false, error: "Tâche introuvable." };
  const task = taskRow as { id: string; restaurant_id: string; temperature_point_id: string; status: string };
  if (task.status !== "pending") return { ok: false, error: "Cette tâche est déjà traitée." };

  const point = await getTemperaturePoint(restaurantId, task.temperature_point_id);
  if (!point) return { ok: false, error: "Point de mesure introuvable." };

  const parsed = parseTemperatureInput(params.temperatureRaw);
  if (!parsed.ok) return parsed;

  const logStatus = classifyTemperatureStatus(parsed.value, point.min_threshold, point.max_threshold);

  const comment = params.comment?.trim() || null;
  const corrective = params.correctiveAction?.trim() || null;
  const productImpact = params.productImpact?.trim() || null;

  if (requiresCorrectiveFields(logStatus)) {
    if (!comment) return { ok: false, error: "Commentaire obligatoire en cas d’alerte ou d’écart critique." };
    if (!corrective) return { ok: false, error: "Action corrective obligatoire en cas d’alerte ou d’écart critique." };
  }

  const display = displayFromUser(user);

  const { error: insErr } = await supabaseServer.from("temperature_logs").insert({
    restaurant_id: restaurantId,
    temperature_point_id: point.id,
    task_id: task.id,
    value: parsed.value,
    log_status: logStatus,
    recorded_by_user_id: user.id,
    recorded_by_display: display,
    comment,
    corrective_action: corrective,
    product_impact: productImpact,
  });

  if (insErr) return { ok: false, error: insErr.message };

  const { error: updErr } = await supabaseServer
    .from("temperature_tasks")
    .update({ status: "completed" })
    .eq("id", taskId)
    .eq("restaurant_id", restaurantId);

  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/hygiene/haccp");
  revalidatePath("/hygiene/haccp/check");
  revalidatePath("/hygiene/haccp/registre");
  return { ok: true };
}
