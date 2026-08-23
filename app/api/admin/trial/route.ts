/**
 * POST /api/admin/trial
 * Crée (ou prolonge) un accès d'essai pour un restaurant.
 * Réservé aux superadmins.
 */

import { NextRequest, NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Vérification admin
  const [isAdmin, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const { restaurantId, days, source, notes } = body as {
    restaurantId: string;
    days: number;
    source: string;
    notes?: string;
  };

  if (!restaurantId || !days || days < 1 || days > 90) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseServer.from("trial_accesses").insert({
    restaurant_id: restaurantId,
    granted_by: user.id,
    source: source ?? "demo_by_medhi",
    expires_at: expiresAt,
    notes: notes?.trim() || null,
  });

  if (error) {
    console.error("[admin/trial] Supabase error:", error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }

  await logAdminSupportActivity({
    authorId: user.id,
    restaurantId,
    action: "trial_granted",
    summary: `Essai ${days}j accordé (${source ?? "demo_by_medhi"})`,
    metadata: { days, source, expiresAt },
  });

  return NextResponse.json({ ok: true, expiresAt });
}
