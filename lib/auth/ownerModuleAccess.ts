import "server-only";

import { isCurrentUserAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

/** Accès propriétaire aux modules sensibles (Ma poche, RH, Équipe…) — inclut les admins plateforme. */
export async function hasOwnerModuleAccess(
  userId: string,
  restaurantOwnerId: string
): Promise<boolean> {
  if (userId === restaurantOwnerId) return true;
  return isCurrentUserAdmin();
}

export async function gateOwnerModule(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };
  const { data } = await supabaseServer
    .from("restaurants")
    .select("owner_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!data || !(await hasOwnerModuleAccess(user.id, (data as { owner_id: string }).owner_id))) {
    return { ok: false, error: "Réservé au propriétaire de l'établissement." };
  }
  return { ok: true };
}
