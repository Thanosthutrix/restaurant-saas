"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, getAccessibleRestaurantsForUser, ACTIVE_RESTAURANT_COOKIE } from "@/lib/auth";
import { purgeRestaurantData } from "@/lib/compliance/purgeRestaurantData";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient } from "@/lib/supabase/server";

const CONFIRM_DELETE_RESTAURANT = "SUPPRIMER";
const CONFIRM_DELETE_ACCOUNT = "SUPPRIMER MON COMPTE";

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

export type DeleteForeverError = { ok: false; error: string };

export async function deleteRestaurantForever(
  restaurantId: string,
  confirmation: string
): Promise<DeleteForeverError | void> {
  if (confirmation.trim() !== CONFIRM_DELETE_RESTAURANT) {
    return { ok: false, error: `Tapez exactement : ${CONFIRM_DELETE_RESTAURANT}` };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const list = await getAccessibleRestaurantsForUser(user.id);
  if (!list.some((r) => r.id === restaurantId)) {
    return { ok: false, error: "Restaurant introuvable ou accès refusé." };
  }

  const remainingAfter = list.filter((r) => r.id !== restaurantId);

  const purge = await purgeRestaurantData(restaurantId, user.id);
  if (purge.error) return { ok: false, error: purge.error };

  const cookieStore = await cookies();
  const active = cookieStore.get(ACTIVE_RESTAURANT_COOKIE)?.value;
  if (active === restaurantId) {
    if (remainingAfter.length === 0) {
      cookieStore.delete(ACTIVE_RESTAURANT_COOKIE);
    } else {
      cookieStore.set(ACTIVE_RESTAURANT_COOKIE, remainingAfter[0].id, COOKIE_OPTS);
    }
  }

  revalidatePath("/", "layout");
  if (remainingAfter.length === 0) redirect("/onboarding");
  redirect("/dashboard");
}

export async function deleteUserAccountForever(confirmation: string): Promise<DeleteForeverError | void> {
  if (confirmation.trim() !== CONFIRM_DELETE_ACCOUNT) {
    return { ok: false, error: `Tapez exactement : ${CONFIRM_DELETE_ACCOUNT}` };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const list = await getAccessibleRestaurantsForUser(user.id);
  for (const r of list) {
    const purge = await purgeRestaurantData(r.id, user.id);
    if (purge.error) return { ok: false, error: purge.error };
  }

  const { error } = await supabaseServer.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_RESTAURANT_COOKIE);

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    /* session déjà invalide après suppression utilisateur */
  }

  revalidatePath("/", "layout");
  redirect("/login?deleted=1");
}
