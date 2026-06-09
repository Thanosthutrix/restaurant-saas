"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { supabaseServer } from "@/lib/supabaseServer";
import { serializePeakBandsWeeklyJson, type PeakBandsWeeklyMap } from "@/lib/staff/planningPeakBands";
import { PLANNING_DAY_KEYS } from "@/lib/staff/planningHoursTypes";
import type { RetroSaveOp } from "@/lib/staff/wizard/wizardDiff";

type ActionResult = { ok: true; updated: number } | { ok: false; error: string };

const SHIFT_PATTERNS = new Set(["continuous", "split", "flexible"]);

/**
 * Rétro-enregistrement (OBJECTIF 4.3) : applique les écritures structurelles cochées
 * dans le wizard (fiche salarié / paramètres établissement) en base globale.
 */
export async function applyRetroSaveAction(
  restaurantId: string,
  ops: RetroSaveOp[]
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;
  if (!Array.isArray(ops) || ops.length === 0) return { ok: true, updated: 0 };

  // Regroupe les écritures staff par collaborateur pour limiter les updates.
  const staffPatch = new Map<string, Record<string, unknown>>();
  const restaurantPatch: Record<string, unknown> = {};

  for (const op of ops) {
    const t = op.target;
    switch (t.kind) {
      case "restaurant.securityFloor": {
        const n = Number(op.value);
        if (Number.isFinite(n) && n >= 1) restaurantPatch.planning_security_floor = Math.round(n);
        break;
      }
      case "restaurant.peakBandsWeekly": {
        // value attendu : tableau d'entrées pour un seul jour — non géré ici (cible hebdo globale
        // ambiguë sans clé jour). Ignoré pour éviter d'écraser les autres jours.
        break;
      }
      case "restaurant.staffTargetsWeekly": {
        break;
      }
      case "staff.role": {
        if (typeof op.value === "string" && op.value.trim()) {
          mergePatch(staffPatch, t.staffMemberId, { role_label: op.value.trim() });
        }
        break;
      }
      case "staff.contractWeeklyHours": {
        const n = Number(op.value);
        if (Number.isFinite(n) && n >= 0) {
          mergePatch(staffPatch, t.staffMemberId, { target_weekly_hours: Math.round(n * 10) / 10 });
        }
        break;
      }
      case "staff.maxDailyHours": {
        const n = Number(op.value);
        if (Number.isFinite(n) && n >= 0) {
          mergePatch(staffPatch, t.staffMemberId, {
            max_daily_hours: n === 0 ? null : Math.round(n * 10) / 10,
          });
        }
        break;
      }
      case "staff.defaultShiftPattern": {
        if (typeof op.value === "string" && SHIFT_PATTERNS.has(op.value)) {
          mergePatch(staffPatch, t.staffMemberId, { planning_default_shift_pattern: op.value });
        }
        break;
      }
      case "staff.restRule": {
        const v = op.value as { fixedRestDays?: unknown; weeklyRestDays?: unknown; requireConsecutive?: unknown };
        const days = Array.isArray(v.fixedRestDays)
          ? v.fixedRestDays.filter((d): d is string =>
              (PLANNING_DAY_KEYS as readonly string[]).includes(String(d))
            )
          : [];
        const weeklyRest = Number(v.weeklyRestDays);
        mergePatch(staffPatch, t.staffMemberId, {
          planning_fixed_rest_days: days,
          planning_weekly_rest_days:
            Number.isFinite(weeklyRest) && weeklyRest >= 0 && weeklyRest <= 7
              ? Math.round(weeklyRest)
              : 2,
          planning_require_consecutive_rest: Boolean(v.requireConsecutive),
        });
        break;
      }
    }
  }

  let updated = 0;

  if (Object.keys(restaurantPatch).length > 0) {
    const { error } = await supabaseServer
      .from("restaurants")
      .update(restaurantPatch)
      .eq("id", restaurantId);
    if (error) return { ok: false, error: error.message };
    updated += 1;
  }

  for (const [staffId, patch] of staffPatch) {
    const { error } = await supabaseServer
      .from("staff_members")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", staffId)
      .eq("restaurant_id", restaurantId);
    if (error) return { ok: false, error: error.message };
    updated += 1;
  }

  revalidatePath("/equipe");
  return { ok: true, updated };
}

function mergePatch(
  map: Map<string, Record<string, unknown>>,
  staffId: string,
  patch: Record<string, unknown>
): void {
  const cur = map.get(staffId) ?? {};
  map.set(staffId, { ...cur, ...patch });
}

/** Met à jour les plages de pointe hebdo complètes (toutes les clés jour). */
export async function persistPeakBandsWeeklyAction(
  restaurantId: string,
  map: PeakBandsWeeklyMap
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const gate = await assertRestaurantAction(user.id, restaurantId, "staff.manage");
  if (!gate.ok) return gate;

  const { error } = await supabaseServer
    .from("restaurants")
    .update({ planning_peak_bands_weekly: serializePeakBandsWeeklyJson(map) })
    .eq("id", restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipe");
  return { ok: true, updated: 1 };
}
