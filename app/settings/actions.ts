"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  deleteDiningTableMergeGroup,
  upsertDiningTableMergeGroup,
  upsertReservationCapacitySettings,
} from "@/lib/reservations/capacitySettingsDb";

export async function updateClosedDaysAction(
  closedDays: number[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const restaurant = await getRestaurantForPage();
  if (!restaurant) return { ok: false, error: "Restaurant introuvable." };

  const gate = await assertRestaurantAction(user.id, restaurant.id, "hygiene.mutate");
  if (!gate.ok) return gate;

  const valid = closedDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!valid) return { ok: false, error: "Jours invalides." };

  const { error } = await supabaseServer
    .from("restaurants")
    .update({ closed_days_of_week: closedDays })
    .eq("id", restaurant.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateDiningWaitThresholdsAction(params: {
  greenMinutes: number;
  orangeMinutes: number;
  redMinutes: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const restaurant = await getRestaurantForPage();
  if (!restaurant) return { ok: false, error: "Restaurant introuvable." };

  const gate = await assertRestaurantAction(user.id, restaurant.id, "reservations.mutate");
  if (!gate.ok) return gate;

  const green = Math.round(params.greenMinutes);
  const orange = Math.round(params.orangeMinutes);
  const red = Math.round(params.redMinutes);
  if (!Number.isFinite(green) || green < 1) {
    return { ok: false, error: "Seuil vert invalide." };
  }
  if (!Number.isFinite(orange) || orange <= green) {
    return { ok: false, error: "Le seuil orange doit être supérieur au vert." };
  }
  if (!Number.isFinite(red) || red <= orange) {
    return { ok: false, error: "Le seuil rouge doit être supérieur à l'orange." };
  }

  const { error } = await supabaseServer
    .from("restaurants")
    .update({
      dining_wait_green_minutes: green,
      dining_wait_orange_minutes: orange,
      dining_wait_red_minutes: red,
    })
    .eq("id", restaurant.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/salle");
  return { ok: true };
}

export async function updateReservationCapacitySettingsAction(params: {
  onlineReservationsEnabled: boolean;
  defaultDurationMinutes: number;
  slotStepMinutes: 15 | 30;
  minLeadMinutes: number;
  maxCoversPerSlot: number | null;
  maxOnlineCoversPerSlot: number | null;
  onlineSharePct: number;
  maxPartySizeOnline: number;
  useTableCapacity: boolean;
  reservationNotifyEmail: string | null;
  enforceAvailabilityOnline: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const restaurant = await getRestaurantForPage();
  if (!restaurant) return { ok: false, error: "Restaurant introuvable." };

  const gate = await assertRestaurantAction(user.id, restaurant.id, "reservations.mutate");
  if (!gate.ok) return gate;

  const duration = Math.round(params.defaultDurationMinutes);
  if (duration < 30 || duration > 360 || duration % 15 !== 0) {
    return { ok: false, error: "Durée invalide (30–360 min, multiple de 15)." };
  }

  const slotStep = params.slotStepMinutes === 30 ? 30 : 15;
  const minLead = Math.round(params.minLeadMinutes);
  if (minLead < 0 || minLead > 1440) {
    return { ok: false, error: "Délai minimum invalide." };
  }

  const onlineShare = Math.round(params.onlineSharePct);
  if (onlineShare < 0 || onlineShare > 100) {
    return { ok: false, error: "Part en ligne invalide (0–100 %)." };
  }

  const maxParty = Math.round(params.maxPartySizeOnline);
  if (maxParty < 1 || maxParty > 50) {
    return { ok: false, error: "Max convives en ligne invalide." };
  }

  const { error } = await upsertReservationCapacitySettings(restaurant.id, {
    online_reservations_enabled: params.onlineReservationsEnabled,
    default_duration_minutes: duration,
    slot_step_minutes: slotStep,
    min_lead_minutes: minLead,
    max_covers_per_slot: params.maxCoversPerSlot,
    max_online_covers_per_slot: params.maxOnlineCoversPerSlot,
    online_share_pct: onlineShare,
    max_party_size_online: maxParty,
    use_table_capacity: params.useTableCapacity,
    reservation_notify_email: params.reservationNotifyEmail,
    enforce_availability_online: params.enforceAvailabilityOnline,
  });

  if (error) return { ok: false, error };

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function saveTableMergeGroupAction(params: {
  id?: string;
  label: string;
  tableIds: string[];
  capacity: number;
}): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const restaurant = await getRestaurantForPage();
  if (!restaurant) return { ok: false, error: "Restaurant introuvable." };

  const gate = await assertRestaurantAction(user.id, restaurant.id, "reservations.mutate");
  if (!gate.ok) return gate;

  const { id, error } = await upsertDiningTableMergeGroup({
    restaurantId: restaurant.id,
    id: params.id,
    label: params.label,
    tableIds: params.tableIds,
    capacity: params.capacity,
  });

  if (error || !id) return { ok: false, error: error ?? "Enregistrement impossible." };

  revalidatePath("/settings");
  return { ok: true, data: { id } };
}

export async function deleteTableMergeGroupAction(
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const restaurant = await getRestaurantForPage();
  if (!restaurant) return { ok: false, error: "Restaurant introuvable." };

  const gate = await assertRestaurantAction(user.id, restaurant.id, "reservations.mutate");
  if (!gate.ok) return gate;

  const { error } = await deleteDiningTableMergeGroup(restaurant.id, groupId);
  if (error) return { ok: false, error };

  revalidatePath("/settings");
  return { ok: true };
}
