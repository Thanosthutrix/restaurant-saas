/**
 * POST /api/admin/note
 * Ajoute une note interne sur un restaurant.
 * Réservé aux superadmins.
 * Accepte aussi bien application/json que application/x-www-form-urlencoded
 * (le formulaire de la page détail envoie du form-data).
 */

import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const [isAdmin, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let restaurantId: string | null = null;
  let content: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await req.json();
    restaurantId = body.restaurantId ?? null;
    content = body.content ?? null;
  } else {
    // form-data / x-www-form-urlencoded
    const fd = await req.formData();
    restaurantId = fd.get("restaurantId") as string | null;
    content = fd.get("content") as string | null;
  }

  if (!restaurantId || !content?.trim()) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const { error } = await supabaseServer.from("admin_notes").insert({
    restaurant_id: restaurantId,
    author_id: user.id,
    content: content.trim(),
  });

  if (error) {
    console.error("[admin/note] Supabase error:", error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }

  await logAdminSupportActivity({
    authorId: user.id,
    restaurantId,
    action: "note",
    summary: content.trim().slice(0, 200),
    metadata: { fullLength: content.trim().length },
  });

  // Si c'est un formulaire HTML classique, on redirige
  if (!contentType.includes("application/json")) {
    return Response.redirect(
      new URL(`/admin/restaurants/${restaurantId}`, req.url),
      303
    );
  }

  return NextResponse.json({ ok: true });
}
