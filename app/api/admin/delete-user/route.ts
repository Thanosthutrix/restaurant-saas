/**
 * POST /api/admin/delete-user
 * Supprime définitivement un compte client (Auth + restaurants possédés).
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDeleteUserAccount } from "@/lib/admin/deleteUserAccount";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const [isAdmin, adminUser] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !adminUser) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";

  if (!userId) {
    return NextResponse.json({ error: "userId requis." }, { status: 400 });
  }

  const { data: targetData } = await supabaseServer.auth.admin.getUserById(userId);
  const targetEmail = targetData?.user?.email?.trim().toLowerCase() ?? "";

  if (!targetEmail || confirmation.toLowerCase() !== targetEmail) {
    return NextResponse.json(
      { error: "Confirmez en saisissant l'e-mail exact du compte à supprimer." },
      { status: 400 }
    );
  }

  const result = await adminDeleteUserAccount({
    targetUserId: userId,
    adminUserId: adminUser.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logAdminSupportActivity({
    authorId: adminUser.id,
    action: "user_deleted",
    summary: `Compte supprimé définitivement : ${result.email ?? userId}`,
    metadata: {
      deletedUserId: userId,
      deletedEmail: result.email,
      restaurantsPurged: result.restaurantsPurged,
    },
  });

  return NextResponse.json({
    ok: true,
    email: result.email,
    restaurantsPurged: result.restaurantsPurged,
  });
}
