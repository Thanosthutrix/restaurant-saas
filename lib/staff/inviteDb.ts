import { supabaseServer } from "@/lib/supabaseServer";

const INVITE_TTL_DAYS = 7;

export type StaffInviteWithContext = {
  id: string;
  restaurant_id: string;
  staff_member_id: string;
  token: string;
  expires_at: string;
  restaurant_name: string;
  staff_display_name: string;
};

/** Remplace tout jeton non consommé pour cette fiche. */
export async function createStaffInviteRecord(params: {
  restaurantId: string;
  staffMemberId: string;
  createdByUserId: string;
}): Promise<{ token: string; expires_at: string } | { error: string }> {
  const expires = new Date();
  expires.setDate(expires.getDate() + INVITE_TTL_DAYS);

  const { error: delErr } = await supabaseServer
    .from("staff_invites")
    .delete()
    .eq("staff_member_id", params.staffMemberId)
    .is("consumed_at", null);

  if (delErr) return { error: delErr.message };

  const { data, error } = await supabaseServer
    .from("staff_invites")
    .insert({
      restaurant_id: params.restaurantId,
      staff_member_id: params.staffMemberId,
      expires_at: expires.toISOString(),
      created_by_user_id: params.createdByUserId,
    })
    .select("token, expires_at")
    .single();

  if (error || !data) return { error: error?.message ?? "Création d’invitation impossible." };
  const row = data as { token: string; expires_at: string };
  return { token: row.token, expires_at: row.expires_at };
}

export async function getStaffInviteByToken(
  token: string
): Promise<StaffInviteWithContext | null> {
  const { data: inv, error } = await supabaseServer
    .from("staff_invites")
    .select("id, restaurant_id, staff_member_id, token, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !inv) return null;
  const row = inv as {
    id: string;
    restaurant_id: string;
    staff_member_id: string;
    token: string;
    expires_at: string;
    consumed_at: string | null;
  };
  if (row.consumed_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  const { data: rest } = await supabaseServer
    .from("restaurants")
    .select("name")
    .eq("id", row.restaurant_id)
    .maybeSingle();

  const { data: sm } = await supabaseServer
    .from("staff_members")
    .select("display_name, active, user_id")
    .eq("id", row.staff_member_id)
    .eq("restaurant_id", row.restaurant_id)
    .maybeSingle();

  const smRow = sm as { display_name: string; active: boolean; user_id: string | null } | null;
  if (!smRow?.active || smRow.user_id) return null;

  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    staff_member_id: row.staff_member_id,
    token: row.token,
    expires_at: row.expires_at,
    restaurant_name: String((rest as { name?: string } | null)?.name ?? "Restaurant"),
    staff_display_name: String(smRow.display_name ?? "").trim() || "Collaborateur",
  };
}

export async function consumeStaffInvite(params: {
  inviteId: string;
  staffMemberId: string;
  restaurantId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: linked, error: upErr } = await supabaseServer
    .from("staff_members")
    .update({ user_id: params.userId })
    .eq("id", params.staffMemberId)
    .eq("restaurant_id", params.restaurantId)
    .is("user_id", null)
    .select("id")
    .maybeSingle();

  if (upErr) {
    if (upErr.code === "23505") {
      return {
        ok: false,
        error: "Ce compte est déjà lié à une autre fiche dans ce restaurant.",
      };
    }
    return { ok: false, error: upErr.message };
  }
  if (!linked) {
    return { ok: false, error: "Cette fiche est déjà liée à un compte ou n’est plus valide." };
  }

  const { error } = await supabaseServer
    .from("staff_invites")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", params.inviteId)
    .eq("staff_member_id", params.staffMemberId)
    .is("consumed_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
