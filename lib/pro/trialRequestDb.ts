import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

export type ProTrialRequestRow = {
  id: string;
  user_id: string;
  contact_email: string;
  restaurant_name: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  trial_days: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function createTrialRequest(params: {
  userId: string;
  contactEmail: string;
  restaurantName?: string | null;
  message?: string | null;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const { data: existing } = await supabaseServer
    .from("pro_trial_requests")
    .select("id")
    .eq("user_id", params.userId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "Une demande d'essai est déjà en cours de traitement." };
  }

  const { data, error } = await supabaseServer
    .from("pro_trial_requests")
    .insert({
      user_id: params.userId,
      contact_email: params.contactEmail.trim(),
      restaurant_name: params.restaurantName?.trim() || null,
      message: params.message?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}

export async function getPendingTrialRequestForUser(
  userId: string
): Promise<ProTrialRequestRow | null> {
  const { data } = await supabaseServer
    .from("pro_trial_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ProTrialRequestRow | null) ?? null;
}

export async function getLatestTrialRequestForUser(
  userId: string
): Promise<ProTrialRequestRow | null> {
  const { data } = await supabaseServer
    .from("pro_trial_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ProTrialRequestRow | null) ?? null;
}

export async function listTrialRequests(status?: string): Promise<ProTrialRequestRow[]> {
  let q = supabaseServer.from("pro_trial_requests").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data } = await q.limit(100);
  return (data ?? []) as ProTrialRequestRow[];
}

export async function countPendingTrialRequests(): Promise<number> {
  const { count, error } = await supabaseServer
    .from("pro_trial_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("[countPendingTrialRequests]", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function listPendingTrialRequests(limit = 5): Promise<ProTrialRequestRow[]> {
  const { data } = await supabaseServer
    .from("pro_trial_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as ProTrialRequestRow[];
}

export async function approveTrialRequest(params: {
  requestId: string;
  adminUserId: string;
  trialDays: number;
  adminNotes?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const { data: req } = await supabaseServer
    .from("pro_trial_requests")
    .select("*")
    .eq("id", params.requestId)
    .maybeSingle();

  if (!req) return { error: "Demande introuvable." };
  if ((req as ProTrialRequestRow).status !== "pending") {
    return { error: "Cette demande a déjà été traitée." };
  }

  const row = req as ProTrialRequestRow;
  const expiresAt = new Date(Date.now() + params.trialDays * 86400000).toISOString();

  const { error: entError } = await supabaseServer.from("pro_signup_entitlements").insert({
    user_id: row.user_id,
    kind: "trial",
    status: "active",
    expires_at: expiresAt,
    trial_request_id: row.id,
  });

  if (entError?.code === "23505") {
    return { error: "Cet utilisateur a déjà un droit d'inscription actif." };
  }
  if (entError) return { error: entError.message };

  const { error: updError } = await supabaseServer
    .from("pro_trial_requests")
    .update({
      status: "approved",
      trial_days: params.trialDays,
      reviewed_by: params.adminUserId,
      reviewed_at: new Date().toISOString(),
      admin_notes: params.adminNotes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.requestId);

  if (updError) return { error: updError.message };
  return { ok: true };
}

export async function rejectTrialRequest(params: {
  requestId: string;
  adminUserId: string;
  adminNotes?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabaseServer
    .from("pro_trial_requests")
    .update({
      status: "rejected",
      reviewed_by: params.adminUserId,
      reviewed_at: new Date().toISOString(),
      admin_notes: params.adminNotes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.requestId)
    .eq("status", "pending");

  if (error) return { error: error.message };
  return { ok: true };
}
