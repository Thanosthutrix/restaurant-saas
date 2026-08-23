/**
 * POST /api/admin/impersonate
 * Génère un magic link de connexion pour un utilisateur donné.
 * L'admin peut ainsi voir l'app exactement comme le client la voit.
 *
 * ⚠️  Ce lien contient un token de session valide — à usage unique,
 *     à ne pas partager. Il expire après 24h (comportement Supabase par défaut).
 */

import { NextRequest, NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const [isAdmin, adminUser] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !adminUser) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { userId } = await req.json().catch(() => ({}));
  if (!userId) {
    return NextResponse.json({ error: "userId requis." }, { status: 400 });
  }

  const { data: userData, error: userError } = await supabaseServer.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  // Génère un magic link OTP — quand l'admin clique dessus, il est connecté en tant que ce user
  const { data, error } = await supabaseServer.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard`,
    },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message ?? "Impossible de générer le lien." },
      { status: 500 }
    );
  }

  const { data: ownedRestaurants } = await supabaseServer
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", userId)
    .limit(1);

  const rest = ownedRestaurants?.[0] as { id: string; name: string } | undefined;

  await logAdminSupportActivity({
    authorId: adminUser.id,
    restaurantId: rest?.id ?? null,
    action: "impersonate",
    summary: `Lien impersonation généré pour ${userData.user.email}`,
    metadata: { userId, userEmail: userData.user.email, restaurantName: rest?.name ?? null },
  });

  return NextResponse.json({ ok: true, link: data.properties.action_link });
}
