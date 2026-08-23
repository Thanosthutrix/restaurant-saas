/**
 * POST /api/admin/suspend
 * Suspend ou débloque un compte restaurant.
 * Réservé aux superadmins.
 */

import { NextRequest, NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const [isAdmin, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const { restaurantId, suspend, reason } = body as {
    restaurantId: string;
    suspend: boolean;
    reason?: string;
  };

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId requis" }, { status: 400 });
  }

  const update = suspend
    ? {
        suspended_at: new Date().toISOString(),
        suspended_reason: reason?.trim() || null,
      }
    : {
        suspended_at: null,
        suspended_reason: null,
      };

  const { error } = await supabaseServer
    .from("restaurants")
    .update(update)
    .eq("id", restaurantId);

  if (error) {
    console.error("[admin/suspend] Supabase error:", error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }

  await logAdminSupportActivity({
    authorId: user.id,
    restaurantId,
    action: suspend ? "suspend" : "unsuspend",
    summary: suspend
      ? `Compte suspendu${reason?.trim() ? ` — ${reason.trim()}` : ""}`
      : "Compte réactivé",
    metadata: { reason: reason?.trim() || null },
  });

  return NextResponse.json({ ok: true, suspended: suspend });
}
