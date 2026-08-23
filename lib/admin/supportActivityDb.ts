import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import type { AdminSupportAction } from "@/lib/admin/supportTypes";

export type AdminSupportActivityRow = {
  id: string;
  author_id: string | null;
  restaurant_id: string | null;
  prospect_id: string | null;
  action: AdminSupportAction;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function logAdminSupportActivity(params: {
  authorId: string | null;
  action: AdminSupportAction;
  summary: string;
  restaurantId?: string | null;
  prospectId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseServer.from("admin_support_activities").insert({
    author_id: params.authorId,
    restaurant_id: params.restaurantId ?? null,
    prospect_id: params.prospectId ?? null,
    action: params.action,
    summary: params.summary.trim(),
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("[supportActivity] log failed:", error.message);
  }
}

export async function getAdminSupportActivities(params?: {
  limit?: number;
  restaurantId?: string;
  action?: AdminSupportAction;
}): Promise<AdminSupportActivityRow[]> {
  const limit = params?.limit ?? 50;

  let query = supabaseServer
    .from("admin_support_activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params?.restaurantId) {
    query = query.eq("restaurant_id", params.restaurantId);
  }
  if (params?.action) {
    query = query.eq("action", params.action);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as AdminSupportActivityRow[];
}

export async function getAdminSupportActivitiesEnriched(limit = 50): Promise<
  (AdminSupportActivityRow & {
    restaurantName: string | null;
    prospectContact: string | null;
    authorEmail: string | null;
  })[]
> {
  const rows = await getAdminSupportActivities({ limit });
  if (rows.length === 0) return [];

  const restaurantIds = [...new Set(rows.map((r) => r.restaurant_id).filter(Boolean))] as string[];
  const prospectIds = [...new Set(rows.map((r) => r.prospect_id).filter(Boolean))] as string[];
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[];

  const restaurantMap = new Map<string, string>();
  if (restaurantIds.length > 0) {
    const { data } = await supabaseServer.from("restaurants").select("id, name").in("id", restaurantIds);
    for (const r of data ?? []) restaurantMap.set(r.id as string, r.name as string);
  }

  const prospectMap = new Map<string, string>();
  if (prospectIds.length > 0) {
    const { data } = await supabaseServer
      .from("prospects")
      .select("id, contact_name, contact_email")
      .in("id", prospectIds);
    for (const p of data ?? []) {
      prospectMap.set(
        p.id as string,
        (p.contact_name as string | null) ?? (p.contact_email as string)
      );
    }
  }

  const authorMap = new Map<string, string>();
  for (const uid of authorIds) {
    const { data } = await supabaseServer.auth.admin.getUserById(uid);
    authorMap.set(uid, data?.user?.email ?? "Admin");
  }

  return rows.map((row) => ({
    ...row,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    restaurantName: row.restaurant_id ? restaurantMap.get(row.restaurant_id) ?? null : null,
    prospectContact: row.prospect_id ? prospectMap.get(row.prospect_id) ?? null : null,
    authorEmail: row.author_id ? authorMap.get(row.author_id) ?? null : null,
  }));
}
