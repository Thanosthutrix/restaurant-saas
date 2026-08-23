/**
 * Fonctions utilitaires pour l'espace admin Ubion.
 * Toutes les fonctions utilisent supabaseServer (service_role) → bypass RLS.
 * À importer uniquement dans des Server Components ou Server Actions.
 */

import { cache } from "react";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";
import {
  type AdminRestaurant,
  type AdminTrialAccess,
  type AdminNote,
  type AdminUsageMetrics,
  type AdminStats,
  type AdminClientStatus,
  type AdminProspect,
  type AdminProspectNote,
  type AdminProspectStatus,
  INACTIVE_DAYS_DEFAULT,
  getAdminClientStatus,
  isInactiveClient,
  getAdminClientStatusLabel,
} from "@/lib/admin/types";
import {
  buildProspectInviteUrl,
  PROSPECT_INVITE_TTL_DAYS,
  regenerateProspectInvite,
} from "@/lib/admin/prospectInviteDb";
import { notifyAdminNewProspect } from "@/lib/admin/notifyNewProspect";
import {
  BILLING_BASE_PRICE_EUR,
  formatBillingOfferDetail,
  isStripeConfigured,
} from "@/lib/billing/config";

export type {
  AdminRestaurant,
  AdminTrialAccess,
  AdminNote,
  AdminUsageMetrics,
  AdminStats,
  AdminClientStatus,
  AdminProspect,
  AdminProspectNote,
  AdminProspectStatus,
};
export { getAdminClientStatus, isInactiveClient, getAdminClientStatusLabel, INACTIVE_DAYS_DEFAULT };
export { buildProspectInviteUrl, PROSPECT_INVITE_TTL_DAYS };

const INACTIVE_DAYS = INACTIVE_DAYS_DEFAULT;

export const isCurrentUserAdmin = cache(async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data: platformAdmin } = await supabaseServer
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (platformAdmin) return true;

  const adminEmail = process.env.ADMIN_EMAIL ?? "medhi.thuleau@gmail.com";
  return user.email === adminEmail;
});

// ── Statistiques globales ──────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [totalResult, newResult, trialsResult, prospectsResult] = await Promise.all([
    supabaseServer.from("restaurants").select("id", { count: "exact", head: true }),
    supabaseServer
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .gte("created_at", firstDayOfMonth),
    supabaseServer
      .from("trial_accesses")
      .select("id", { count: "exact", head: true })
      .gt("expires_at", now.toISOString()),
    supabaseServer
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "contacted", "demo_scheduled", "invited"]),
  ]);

  return {
    totalRestaurants: totalResult.count ?? 0,
    newThisMonth: newResult.count ?? 0,
    activeTrials: trialsResult.count ?? 0,
    inactiveCount: 0,
    activeProspects: prospectsResult.count ?? 0,
  };
}

export async function getInactiveRestaurants(days = INACTIVE_DAYS): Promise<AdminRestaurant[]> {
  const all = await getAllRestaurantsWithOwners();
  return all.filter((r) => isInactiveClient(r, days));
}

export async function getAdminStatsWithInactive(): Promise<AdminStats> {
  const [stats, all] = await Promise.all([getAdminStats(), getAllRestaurantsWithOwners()]);
  return {
    ...stats,
    inactiveCount: all.filter((r) => isInactiveClient(r)).length,
  };
}

export async function getAdminPlatformSettings() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "medhi.thuleau@gmail.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

  const { count: platformAdminsCount } = await supabaseServer
    .from("platform_admins")
    .select("user_id", { count: "exact", head: true });

  return {
    adminEmail,
    appUrl,
    platformAdminsCount: platformAdminsCount ?? 0,
    monthlyPriceEur: BILLING_BASE_PRICE_EUR,
    billingOfferDetail: formatBillingOfferDetail(),
    stripeConfigured: isStripeConfigured(),
    webhookNewRestaurantUrl: `${appUrl}/api/webhooks/new-restaurant`,
    webhookNewProspectUrl: `${appUrl}/api/webhooks/new-prospect`,
    stripeWebhookUrl: `${appUrl}/api/stripe/webhook`,
  };
}

// ── Liste de tous les restaurants ─────────────────────────────────────────

export async function getAllRestaurantsWithOwners(): Promise<AdminRestaurant[]> {
  const { data: restaurants, error } = await supabaseServer
    .from("restaurants")
    .select("id, name, owner_id, activity_type, created_at, suspended_at, suspended_reason")
    .order("created_at", { ascending: false });

  if (error || !restaurants) return [];

  const { data: trials } = await supabaseServer
    .from("trial_accesses")
    .select("id, restaurant_id, source, expires_at, notes, created_at")
    .order("created_at", { ascending: false });

  const ownerIds = [...new Set(restaurants.map((r) => r.owner_id).filter(Boolean))];
  const userMap: Record<string, { email: string | null; name: string | null; last_sign_in: string | null }> = {};

  for (const uid of ownerIds) {
    const { data } = await supabaseServer.auth.admin.getUserById(uid);
    if (data?.user) {
      userMap[uid] = {
        email: data.user.email ?? null,
        name:
          (data.user.user_metadata?.full_name as string | undefined) ??
          (data.user.user_metadata?.name as string | undefined) ??
          null,
        last_sign_in: data.user.last_sign_in_at ?? null,
      };
    }
  }

  const trialsByRestaurant: Record<string, AdminTrialAccess> = {};
  for (const t of trials ?? []) {
    const r = t as AdminTrialAccess;
    if (!trialsByRestaurant[r.restaurant_id]) {
      trialsByRestaurant[r.restaurant_id] = r;
    }
  }

  return restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    owner_id: r.owner_id,
    owner_email: userMap[r.owner_id]?.email ?? null,
    owner_name: userMap[r.owner_id]?.name ?? null,
    owner_last_sign_in: userMap[r.owner_id]?.last_sign_in ?? null,
    activity_type: r.activity_type,
    created_at: r.created_at,
    suspended_at: r.suspended_at ?? null,
    suspended_reason: r.suspended_reason ?? null,
    trial: trialsByRestaurant[r.id] ?? null,
  }));
}

// ── Métriques d'usage d'un restaurant ─────────────────────────────────────

export async function getRestaurantUsageMetrics(restaurantId: string): Promise<AdminUsageMetrics> {
  const [invoices, deliveries, suppliers, tickets, staff, reservations] = await Promise.all([
    supabaseServer
      .from("supplier_invoices")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabaseServer
      .from("delivery_notes")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabaseServer
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabaseServer
      .from("ticket_imports")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabaseServer
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("active", true),
    supabaseServer
      .from("restaurant_reservations")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
  ]);

  return {
    supplierInvoicesCount: invoices.count ?? 0,
    deliveryNotesCount: deliveries.count ?? 0,
    suppliersCount: suppliers.count ?? 0,
    ticketImportsCount: tickets.count ?? 0,
    staffMembersCount: staff.count ?? 0,
    reservationsCount: reservations.count ?? 0,
  };
}

// ── Détail d'un restaurant ─────────────────────────────────────────────────

export async function getRestaurantAdminDetail(restaurantId: string): Promise<{
  restaurant: AdminRestaurant | null;
  trials: AdminTrialAccess[];
  notes: AdminNote[];
  usage: AdminUsageMetrics;
}> {
  const [restaurantResult, trialsResult, notesResult, usage] = await Promise.all([
    supabaseServer
      .from("restaurants")
      .select("id, name, owner_id, activity_type, created_at, suspended_at, suspended_reason, address_text, service_type, avg_covers")
      .eq("id", restaurantId)
      .maybeSingle(),
    supabaseServer
      .from("trial_accesses")
      .select("id, restaurant_id, source, expires_at, notes, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false }),
    supabaseServer
      .from("admin_notes")
      .select("id, restaurant_id, author_id, content, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false }),
    getRestaurantUsageMetrics(restaurantId),
  ]);

  if (!restaurantResult.data) {
    return { restaurant: null, trials: [], notes: [], usage };
  }

  const r = restaurantResult.data as {
    id: string; name: string; owner_id: string; activity_type: string | null;
    created_at: string; suspended_at: string | null; suspended_reason: string | null;
  };

  let ownerEmail: string | null = null;
  let ownerName: string | null = null;
  let ownerLastSignIn: string | null = null;

  if (r.owner_id) {
    const { data } = await supabaseServer.auth.admin.getUserById(r.owner_id);
    ownerEmail = data?.user?.email ?? null;
    ownerLastSignIn = data?.user?.last_sign_in_at ?? null;
    ownerName =
      (data?.user?.user_metadata?.full_name as string | undefined) ??
      (data?.user?.user_metadata?.name as string | undefined) ??
      null;
  }

  const restaurant: AdminRestaurant = {
    id: r.id,
    name: r.name,
    owner_id: r.owner_id,
    owner_email: ownerEmail,
    owner_name: ownerName,
    owner_last_sign_in: ownerLastSignIn,
    activity_type: r.activity_type,
    created_at: r.created_at,
    suspended_at: r.suspended_at,
    suspended_reason: r.suspended_reason,
    trial: (trialsResult.data?.[0] as AdminTrialAccess) ?? null,
  };

  return {
    restaurant,
    trials: (trialsResult.data ?? []) as AdminTrialAccess[],
    notes: (notesResult.data ?? []) as AdminNote[],
    usage,
  };
}

// ── Tous les essais ────────────────────────────────────────────────────────

export async function getAllTrials(): Promise<
  (AdminTrialAccess & { restaurantName: string; ownerEmail: string | null })[]
> {
  const { data: trials } = await supabaseServer
    .from("trial_accesses")
    .select("id, restaurant_id, source, expires_at, notes, created_at")
    .order("created_at", { ascending: false });

  if (!trials?.length) return [];

  const restaurantIds = [...new Set(trials.map((t) => t.restaurant_id))];
  const { data: restaurants } = await supabaseServer
    .from("restaurants")
    .select("id, name, owner_id")
    .in("id", restaurantIds);

  const restaurantMap: Record<string, { name: string; owner_id: string }> = {};
  for (const r of restaurants ?? []) {
    restaurantMap[r.id] = { name: r.name, owner_id: r.owner_id };
  }

  const ownerIds = [...new Set(Object.values(restaurantMap).map((r) => r.owner_id).filter(Boolean))];
  const emailMap: Record<string, string | null> = {};
  for (const uid of ownerIds) {
    const { data } = await supabaseServer.auth.admin.getUserById(uid);
    emailMap[uid] = data?.user?.email ?? null;
  }

  return trials.map((t) => ({
    ...(t as AdminTrialAccess),
    restaurantName: restaurantMap[t.restaurant_id]?.name ?? "Restaurant inconnu",
    ownerEmail: emailMap[restaurantMap[t.restaurant_id]?.owner_id] ?? null,
  }));
}

// ── Derniers inscrits ──────────────────────────────────────────────────────

export async function getLatestSignups(limit = 10): Promise<AdminRestaurant[]> {
  const all = await getAllRestaurantsWithOwners();
  return all.slice(0, limit);
}

// ── Prospects CRM ──────────────────────────────────────────────────────────

function mapProspectRow(row: Record<string, unknown>): AdminProspect {
  return {
    id: row.id as string,
    contact_name: (row.contact_name as string | null) ?? null,
    contact_email: row.contact_email as string,
    restaurant_name: (row.restaurant_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    source: row.source as string,
    status: row.status as AdminProspectStatus,
    notes: (row.notes as string | null) ?? null,
    invite_token: row.invite_token as string,
    invite_expires_at: (row.invite_expires_at as string | null) ?? null,
    invite_consumed_at: (row.invite_consumed_at as string | null) ?? null,
    trial_days: (row.trial_days as number | null) ?? null,
    restaurant_id: (row.restaurant_id as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getAllProspects(): Promise<AdminProspect[]> {
  const { data, error } = await supabaseServer
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapProspectRow(row as Record<string, unknown>));
}

export async function getProspectsToFollowUp(limit = 8): Promise<AdminProspect[]> {
  const all = await getAllProspects();
  return all
    .filter((p) => ["new", "contacted", "demo_scheduled"].includes(p.status))
    .slice(0, limit);
}

export async function getProspectAdminDetail(prospectId: string): Promise<{
  prospect: AdminProspect | null;
  notes: AdminProspectNote[];
  inviteUrl: string | null;
}> {
  const [prospectResult, notesResult] = await Promise.all([
    supabaseServer.from("prospects").select("*").eq("id", prospectId).maybeSingle(),
    supabaseServer
      .from("prospect_notes")
      .select("id, prospect_id, author_id, content, created_at")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false }),
  ]);

  if (!prospectResult.data) {
    return { prospect: null, notes: [], inviteUrl: null };
  }

  const prospect = mapProspectRow(prospectResult.data as Record<string, unknown>);
  const inviteUrl =
    !prospect.invite_consumed_at && prospect.status !== "signed_up" && prospect.status !== "lost"
      ? buildProspectInviteUrl(prospect.invite_token)
      : null;

  return {
    prospect,
    notes: (notesResult.data ?? []) as AdminProspectNote[],
    inviteUrl,
  };
}

export async function createProspectRecord(params: {
  contactName?: string;
  contactEmail: string;
  restaurantName?: string;
  phone?: string;
  source?: string;
  notes?: string;
  trialDays?: number | null;
  createdByUserId: string;
  sendInvite?: boolean;
}): Promise<{ prospect: AdminProspect; inviteUrl: string } | { error: string }> {
  const expires = new Date();
  expires.setDate(expires.getDate() + PROSPECT_INVITE_TTL_DAYS);

  const { data, error } = await supabaseServer
    .from("prospects")
    .insert({
      contact_name: params.contactName?.trim() || null,
      contact_email: params.contactEmail.trim().toLowerCase(),
      restaurant_name: params.restaurantName?.trim() || null,
      phone: params.phone?.trim() || null,
      source: params.source ?? "outbound",
      status: params.sendInvite ? "invited" : "new",
      notes: params.notes?.trim() || null,
      trial_days: params.trialDays && params.trialDays > 0 ? params.trialDays : null,
      invite_expires_at: expires.toISOString(),
      created_by: params.createdByUserId,
    })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Création impossible." };

  const prospect = mapProspectRow(data as Record<string, unknown>);
  const inviteUrl = buildProspectInviteUrl(prospect.invite_token);

  const settings = await getAdminPlatformSettings();
  await notifyAdminNewProspect({
    contactName: prospect.contact_name,
    contactEmail: prospect.contact_email,
    restaurantName: prospect.restaurant_name,
    source: prospect.source,
    prospectId: prospect.id,
    appUrl: settings.appUrl,
  });

  return { prospect, inviteUrl };
}

export async function updateProspectStatusRecord(params: {
  prospectId: string;
  status: AdminProspectStatus;
}): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabaseServer
    .from("prospects")
    .update({ status: params.status, updated_at: new Date().toISOString() })
    .eq("id", params.prospectId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function addProspectNoteRecord(params: {
  prospectId: string;
  authorId: string;
  content: string;
}): Promise<{ ok: true } | { error: string }> {
  const content = params.content.trim();
  if (!content) return { error: "Note vide." };

  const { error } = await supabaseServer.from("prospect_notes").insert({
    prospect_id: params.prospectId,
    author_id: params.authorId,
    content,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function refreshProspectInviteRecord(prospectId: string): Promise<
  { inviteUrl: string; expiresAt: string } | { error: string }
> {
  const result = await regenerateProspectInvite(prospectId);
  if ("error" in result) return { error: result.error };
  return { inviteUrl: result.inviteUrl, expiresAt: result.expires_at };
}
