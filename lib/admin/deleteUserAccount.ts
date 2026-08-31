import "server-only";

import { purgeRestaurantData } from "@/lib/compliance/purgeRestaurantData";
import { supabaseServer } from "@/lib/supabaseServer";

async function isUserPlatformAdmin(userId: string, email: string | null): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "medhi.thuleau@gmail.com";
  if (email === adminEmail) return true;

  const { data } = await supabaseServer
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

export type AdminDeleteUserResult =
  | { ok: true; email: string | null; restaurantsPurged: number }
  | { ok: false; error: string };

/**
 * Suppression définitive d'un compte utilisateur (Auth + données liées).
 * Purge d'abord les restaurants possédés, puis supprime l'utilisateur Supabase Auth.
 */
export async function adminDeleteUserAccount(params: {
  targetUserId: string;
  adminUserId: string;
}): Promise<AdminDeleteUserResult> {
  const { targetUserId, adminUserId } = params;

  if (targetUserId === adminUserId) {
    return {
      ok: false,
      error: "Vous ne pouvez pas supprimer votre propre compte depuis l'admin.",
    };
  }

  const { data: targetData, error: userError } =
    await supabaseServer.auth.admin.getUserById(targetUserId);
  if (userError || !targetData?.user) {
    return { ok: false, error: "Utilisateur introuvable." };
  }

  const targetEmail = targetData.user.email ?? null;

  if (await isUserPlatformAdmin(targetUserId, targetEmail)) {
    return {
      ok: false,
      error: "Impossible de supprimer un compte administrateur Ubion.",
    };
  }

  const { data: ownedRestaurants, error: listErr } = await supabaseServer
    .from("restaurants")
    .select("id")
    .eq("owner_id", targetUserId);

  if (listErr) return { ok: false, error: listErr.message };

  for (const row of ownedRestaurants ?? []) {
    const purge = await purgeRestaurantData(String(row.id), targetUserId);
    if (purge.error) return { ok: false, error: purge.error };
  }

  const { error: deleteErr } = await supabaseServer.auth.admin.deleteUser(targetUserId);
  if (deleteErr) return { ok: false, error: deleteErr.message };

  return {
    ok: true,
    email: targetEmail,
    restaurantsPurged: ownedRestaurants?.length ?? 0,
  };
}
