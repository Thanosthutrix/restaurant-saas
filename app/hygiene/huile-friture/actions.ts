"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import {
  endOilBatch,
  ensureActiveOilBatch,
  getFryerUnit,
  startOilBatch,
} from "@/lib/fryerOil/fryerOilDb";
import {
  classifyFryerOilCheck,
  parseOilTemperatureInput,
  parseTpmInput,
  requiresCorrectiveFields,
} from "@/lib/fryerOil/rules";
import {
  FRYER_RECURRENCE_TYPES,
  TPM_TEST_METHODS,
  type FryerRecurrenceType,
  type OilBatchEndReason,
  type TpmTestMethod,
} from "@/lib/fryerOil/types";
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

export async function upsertFryerUnitAction(
  restaurantId: string,
  payload: {
    id?: string | null;
    name: string;
    location: string;
    capacity_liters?: number | null;
    oil_temp_min_celsius: number;
    oil_temp_max_celsius: number;
    tpm_alert_threshold_pct: number;
    tpm_change_threshold_pct: number;
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

  if (!(FRYER_RECURRENCE_TYPES as readonly string[]).includes(payload.recurrence_type)) {
    return { ok: false, error: "Récurrence invalide." };
  }

  const min = Number(payload.oil_temp_min_celsius);
  const max = Number(payload.oil_temp_max_celsius);
  const tpmAlert = Number(payload.tpm_alert_threshold_pct);
  const tpmChange = Number(payload.tpm_change_threshold_pct);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return { ok: false, error: "Plage de température huile invalide." };
  }
  if (!Number.isFinite(tpmAlert) || !Number.isFinite(tpmChange) || tpmAlert >= tpmChange) {
    return { ok: false, error: "Seuils TPM invalides (alerte < changement)." };
  }

  const row = {
    restaurant_id: restaurantId,
    name,
    location: payload.location.trim(),
    capacity_liters: payload.capacity_liters ?? null,
    oil_temp_min_celsius: min,
    oil_temp_max_celsius: max,
    tpm_alert_threshold_pct: tpmAlert,
    tpm_change_threshold_pct: tpmChange,
    recurrence_type: payload.recurrence_type as FryerRecurrenceType,
    active: payload.active,
    updated_at: new Date().toISOString(),
  };

  if (payload.id) {
    const existing = await getFryerUnit(restaurantId, payload.id);
    if (!existing) return { ok: false, error: "Friteuse introuvable." };
    const { error } = await supabaseServer
      .from("fryer_units")
      .update(row)
      .eq("id", payload.id)
      .eq("restaurant_id", restaurantId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabaseServer.from("fryer_units").insert(row).select("id").single();
    if (error) return { ok: false, error: error.message };
    const display = displayFromUser(user);
    if (data) {
      await ensureActiveOilBatch(restaurantId, String((data as { id: string }).id), display);
    }
  }

  revalidateFryerOilPaths();
  return { ok: true };
}

export async function setFryerUnitActiveAction(
  restaurantId: string,
  unitId: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("fryer_units")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", unitId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };
  revalidateFryerOilPaths();
  return { ok: true };
}

export async function submitFryerOilCheckAction(
  restaurantId: string,
  taskId: string,
  params: {
    tpmRaw: string;
    tpmTestMethod: string;
    oilTemperatureRaw: string;
    filtrationDone: boolean;
    qualityOk: boolean;
    qualityIssues: string | null;
    oilChanged: boolean;
    newOilProductName: string | null;
    comment: string | null;
    correctiveAction: string | null;
  }
): Promise<{ ok: true; changeOilRequired: boolean } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const gate = await assertRestaurantAction(user.id, restaurantId, "hygiene.mutate");
  if (!gate.ok) return gate;

  if (!(TPM_TEST_METHODS as readonly string[]).includes(params.tpmTestMethod)) {
    return { ok: false, error: "Méthode de test TPM invalide." };
  }

  const { data: taskRow, error: taskErr } = await supabaseServer
    .from("fryer_oil_tasks")
    .select("id, restaurant_id, fryer_unit_id, status")
    .eq("id", taskId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (taskErr || !taskRow) return { ok: false, error: "Tâche introuvable." };
  const task = taskRow as { id: string; fryer_unit_id: string; status: string };
  if (task.status !== "pending") return { ok: false, error: "Cette tâche est déjà traitée." };

  const unit = await getFryerUnit(restaurantId, task.fryer_unit_id);
  if (!unit) return { ok: false, error: "Friteuse introuvable." };

  const tempParsed = parseOilTemperatureInput(params.oilTemperatureRaw);
  if (!tempParsed.ok) return tempParsed;

  let tpmPercent: number | null = null;
  if (params.tpmTestMethod !== "visual_estimated" || params.tpmRaw.trim()) {
    const tpmParsed = parseTpmInput(params.tpmRaw);
    if (!tpmParsed.ok) return tpmParsed;
    tpmPercent = tpmParsed.value;
  }

  const classification = classifyFryerOilCheck({
    unit,
    tpmPercent,
    oilTemperatureCelsius: tempParsed.value,
    qualityOk: params.qualityOk,
    filtrationDone: params.filtrationDone,
  });

  let changeOilRequired = classification.changeOilRequired || params.oilChanged;
  if (params.oilChanged) changeOilRequired = true;

  const comment = params.comment?.trim() || null;
  const corrective = params.correctiveAction?.trim() || null;

  if (requiresCorrectiveFields(classification.logStatus) || changeOilRequired) {
    if (!comment) {
      return { ok: false, error: "Commentaire obligatoire en cas d'alerte ou changement d'huile." };
    }
    if (!corrective && changeOilRequired) {
      return {
        ok: false,
        error: "Action corrective obligatoire (ex. changement huile, filtration renforcée).",
      };
    }
  }

  const display = displayFromUser(user);
  let batch = await ensureActiveOilBatch(restaurantId, unit.id, display);

  let oilChanged = false;
  if (changeOilRequired && params.oilChanged) {
    const endReason: OilBatchEndReason = classification.changeOilRequired
      ? "tpm_threshold"
      : params.qualityOk
        ? "scheduled"
        : "quality";
    await endOilBatch({
      batchId: batch.id,
      restaurantId,
      endReason,
      notes: comment,
    });
    batch = await startOilBatch({
      restaurantId,
      fryerUnitId: unit.id,
      oilProductName: params.newOilProductName,
      recordedByDisplay: display,
      notes: comment,
    });
    oilChanged = true;
  }

  const { error: insErr } = await supabaseServer.from("fryer_oil_logs").insert({
    restaurant_id: restaurantId,
    fryer_unit_id: unit.id,
    oil_batch_id: batch.id,
    task_id: task.id,
    tpm_percent: tpmPercent,
    tpm_test_method: params.tpmTestMethod as TpmTestMethod,
    oil_temperature_celsius: tempParsed.value,
    filtration_done: params.filtrationDone,
    quality_ok: params.qualityOk,
    quality_issues: params.qualityIssues?.trim() || null,
    log_status: changeOilRequired && !oilChanged ? "critical" : classification.logStatus,
    change_oil_required: changeOilRequired,
    oil_changed: oilChanged,
    recorded_by_user_id: user.id,
    recorded_by_display: display,
    comment,
    corrective_action: corrective,
  });

  if (insErr) return { ok: false, error: insErr.message };

  const { error: updErr } = await supabaseServer
    .from("fryer_oil_tasks")
    .update({ status: "completed" })
    .eq("id", taskId)
    .eq("restaurant_id", restaurantId);

  if (updErr) return { ok: false, error: updErr.message };

  revalidateFryerOilPaths();
  return { ok: true, changeOilRequired };
}

function revalidateFryerOilPaths() {
  revalidatePath("/hygiene/huile-friture");
  revalidatePath("/hygiene/huile-friture/units");
  revalidatePath("/hygiene/huile-friture/check");
  revalidatePath("/hygiene/huile-friture/registre");
  revalidatePath("/hygiene");
  revalidatePath("/hygiene/haccp");
}
