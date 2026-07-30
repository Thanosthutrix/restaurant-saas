"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getRestaurantForPage } from "@/lib/auth";
import { assertRestaurantAction } from "@/lib/auth/restaurantActionAccess";
import { supabaseServer } from "@/lib/supabaseServer";

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
