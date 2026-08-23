import { supabaseServer } from "@/lib/supabaseServer";

export const PROSPECT_INVITE_TTL_DAYS = 30;

export type ProspectInvitePublic = {
  contact_email: string;
  contact_name: string | null;
  restaurant_name: string | null;
};

export type ProspectRow = {
  id: string;
  contact_name: string | null;
  contact_email: string;
  restaurant_name: string | null;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
  invite_token: string;
  invite_expires_at: string | null;
  invite_consumed_at: string | null;
  trial_days: number | null;
  restaurant_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function buildProspectInviteUrl(token: string, appUrl?: string): string {
  const base = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  return `${base.replace(/\/$/, "")}/signup?invite=${token}`;
}

function isInviteValid(row: Pick<ProspectRow, "invite_consumed_at" | "invite_expires_at">): boolean {
  if (row.invite_consumed_at) return false;
  if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) return false;
  return true;
}

export async function getProspectInvitePublic(token: string): Promise<ProspectInvitePublic | null> {
  const { data, error } = await supabaseServer
    .from("prospects")
    .select("contact_email, contact_name, restaurant_name, invite_consumed_at, invite_expires_at, status")
    .eq("invite_token", token)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as ProspectRow & { status: string };
  if (!isInviteValid(row)) return null;
  if (row.status === "signed_up" || row.status === "lost") return null;

  return {
    contact_email: row.contact_email,
    contact_name: row.contact_name,
    restaurant_name: row.restaurant_name,
  };
}

export async function regenerateProspectInvite(prospectId: string): Promise<
  { token: string; expires_at: string; inviteUrl: string } | { error: string }
> {
  const expires = new Date();
  expires.setDate(expires.getDate() + PROSPECT_INVITE_TTL_DAYS);

  const token = crypto.randomUUID();
  const expiresAt = expires.toISOString();

  const { error } = await supabaseServer
    .from("prospects")
    .update({
      invite_token: token,
      invite_expires_at: expiresAt,
      invite_consumed_at: null,
      status: "invited",
      updated_at: new Date().toISOString(),
    })
    .eq("id", prospectId)
    .is("invite_consumed_at", null)
    .neq("status", "signed_up");

  if (error) return { error: error.message };

  return {
    token,
    expires_at: expiresAt,
    inviteUrl: buildProspectInviteUrl(token),
  };
}

export async function consumeProspectInvite(params: {
  token: string;
  restaurantId: string;
  userId: string;
}): Promise<{ ok: true; prospectId: string } | { ok: false; error: string }> {
  const { data: prospect, error: fetchErr } = await supabaseServer
    .from("prospects")
    .select("id, invite_consumed_at, invite_expires_at, status, trial_days, created_by")
    .eq("invite_token", params.token)
    .maybeSingle();

  if (fetchErr || !prospect) {
    return { ok: false, error: "Invitation invalide ou expirée." };
  }

  const row = prospect as ProspectRow;
  if (!isInviteValid(row)) {
    return { ok: false, error: "Invitation invalide ou expirée." };
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabaseServer
    .from("prospects")
    .update({
      restaurant_id: params.restaurantId,
      invite_consumed_at: now,
      status: "signed_up",
      updated_at: now,
    })
    .eq("id", row.id)
    .is("invite_consumed_at", null);

  if (updateErr) return { ok: false, error: updateErr.message };

  if (row.trial_days && row.trial_days >= 1) {
    const expiresAt = new Date(Date.now() + row.trial_days * 86400000).toISOString();
    await supabaseServer.from("trial_accesses").insert({
      restaurant_id: params.restaurantId,
      granted_by: row.created_by,
      source: "demo_by_medhi",
      expires_at: expiresAt,
      notes: `Essai auto via invitation prospect ${row.id}`,
    });
  }

  return { ok: true, prospectId: row.id };
}
