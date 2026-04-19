"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createInventoryItem } from "@/app/inventory/actions";
import { getCurrentUser } from "@/lib/auth";
import { parseTemperatureInput } from "@/lib/haccpTemperature/rules";
import { getPreparationRecord, getPreparationRecordByLotReference } from "@/lib/preparations/preparationsDb";
import type { PreparationRecord } from "@/lib/preparations/types";
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

function addHoursUtc(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d.toISOString();
}

/** Numéro de lot unique (préfixe fixe pour futur code-barres / douchette). */
function generateLotReference(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `LOT-${ymd}-${suffix}`;
}

export async function lookupPreparationByLotAction(
  restaurantId: string,
  lotQuery: string
): Promise<
  | { ok: true; record: PreparationRecord }
  | { ok: false; error: string }
  | { ok: true; record: null }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const raw = lotQuery.trim();
  if (raw.length < 4) return { ok: false, error: "Saisissez au moins 4 caractères du numéro de lot." };

  const rec = await getPreparationRecordByLotReference(restaurantId, raw);
  if (!rec) return { ok: true, record: null };

  return { ok: true, record: rec };
}

export async function startPreparationAction(
  restaurantId: string,
  params: {
    mode: "inventory" | "dish" | "new";
    inventoryItemId?: string | null;
    dishId?: string | null;
    newName?: string | null;
    newUnit?: string | null;
    comment?: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const display = displayFromUser(user);
  let label = "";
  let inventoryItemId: string | null = null;
  let dishId: string | null = null;

  if (params.mode === "inventory") {
    if (!params.inventoryItemId?.trim()) return { ok: false, error: "Sélectionnez une préparation (stock)." };
    const { data, error } = await supabaseServer
      .from("inventory_items")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .eq("id", params.inventoryItemId)
      .eq("item_type", "prep")
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Composant introuvable." };
    label = String((data as { name: string }).name);
    inventoryItemId = String((data as { id: string }).id);
  } else if (params.mode === "dish") {
    if (!params.dishId?.trim()) return { ok: false, error: "Sélectionnez un plat." };
    const { data, error } = await supabaseServer
      .from("dishes")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .eq("id", params.dishId)
      .maybeSingle();
    if (error || !data) return { ok: false, error: "Plat introuvable." };
    label = String((data as { name: string }).name);
    dishId = String((data as { id: string }).id);
  } else {
    const name = params.newName?.trim() ?? "";
    if (!name) return { ok: false, error: "Indiquez le nom de la nouvelle préparation." };
    const unit = params.newUnit?.trim() || "kg";
    const created = await createInventoryItem({
      restaurantId,
      name,
      unit,
      itemType: "prep",
      currentStockQty: 0,
      minStockQty: null,
    });
    if (!created.ok) return { ok: false, error: created.error };
    inventoryItemId = created.data!.id;
    label = name;
  }

  const { data: ins, error: insErr } = await supabaseServer
    .from("preparation_records")
    .insert({
      restaurant_id: restaurantId,
      inventory_item_id: inventoryItemId,
      dish_id: dishId,
      label,
      recorded_by_user_id: user.id,
      recorded_by_display: display,
      comment: params.comment?.trim() || null,
    })
    .select("id")
    .single();

  if (insErr || !ins) return { ok: false, error: insErr?.message ?? "Enregistrement impossible." };

  revalidatePath("/preparations");
  revalidatePath("/preparations/registre");
  return { ok: true, id: String((ins as { id: string }).id) };
}

export async function recordPreparationTempEndAction(
  restaurantId: string,
  recordId: string,
  temperatureRaw: string
): Promise<{ ok: true; lotReference: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const rec = await getPreparationRecord(restaurantId, recordId);
  if (!rec) return { ok: false, error: "Fiche introuvable." };
  if (rec.temp_end_recorded_at) return { ok: false, error: "La température de fin est déjà enregistrée." };

  const parsed = parseTemperatureInput(temperatureRaw);
  if (!parsed.ok) return parsed;

  const now = new Date().toISOString();
  const due2h = addHoursUtc(now, 2);

  let lotReference = generateLotReference();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await supabaseServer
      .from("preparation_records")
      .update({
        temp_end_celsius: parsed.value,
        temp_end_recorded_at: now,
        temp_2h_due_at: due2h,
        lot_reference: lotReference,
      })
      .eq("id", recordId)
      .eq("restaurant_id", restaurantId);

    if (!error) {
      revalidatePath("/preparations");
      revalidatePath("/preparations/registre");
      return { ok: true, lotReference };
    }
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      lotReference = generateLotReference();
      continue;
    }
    return { ok: false, error: error.message };
  }

  return { ok: false, error: "Impossible d’attribuer un numéro de lot unique. Réessayez." };
}

export async function recordPreparation2hAndDlcAction(
  restaurantId: string,
  recordId: string,
  params: { temperatureRaw: string; dlcDate: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const rec = await getPreparationRecord(restaurantId, recordId);
  if (!rec) return { ok: false, error: "Fiche introuvable." };
  if (!rec.temp_end_recorded_at) return { ok: false, error: "Enregistrez d’abord la température de fin de préparation." };
  if (rec.temp_2h_recorded_at) return { ok: false, error: "Le contrôle à +2 h est déjà enregistré." };

  const parsed = parseTemperatureInput(params.temperatureRaw);
  if (!parsed.ok) return parsed;

  const dlc = params.dlcDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dlc)) return { ok: false, error: "DLC invalide (format AAAA-MM-JJ)." };

  const now = new Date().toISOString();

  const { error } = await supabaseServer
    .from("preparation_records")
    .update({
      temp_2h_celsius: parsed.value,
      temp_2h_recorded_at: now,
      dlc_date: dlc,
    })
    .eq("id", recordId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/preparations");
  revalidatePath("/preparations/registre");
  return { ok: true };
}
