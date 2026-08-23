/**
 * POST /api/admin/reset-password
 * Génère un lien de réinitialisation de mot de passe (affiché à l'admin).
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

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/update-password`;

  const { data, error } = await supabaseServer.auth.admin.generateLink({
    type: "recovery",
    email: userData.user.email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message ?? "Impossible de générer le lien." },
      { status: 500 }
    );
  }

  const { data: ownedRestaurants } = await supabaseServer
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);

  await logAdminSupportActivity({
    authorId: adminUser.id,
    restaurantId: (ownedRestaurants?.[0]?.id as string | undefined) ?? null,
    action: "reset_password",
    summary: `Lien reset MDP pour ${userData.user.email}`,
    metadata: { userId, userEmail: userData.user.email },
  });

  return NextResponse.json({
    ok: true,
    email: userData.user.email,
    link: data.properties.action_link,
  });
}
