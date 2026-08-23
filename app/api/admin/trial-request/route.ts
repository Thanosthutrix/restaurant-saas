import { NextRequest, NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import {
  approveTrialRequest,
  rejectTrialRequest,
} from "@/lib/pro/trialRequestDb";
import { notifyUserTrialApproved } from "@/lib/pro/notifyTrialRequest";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const [isAdmin, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const { requestId, action, trialDays, adminNotes } = body as {
    requestId: string;
    action: "approve" | "reject";
    trialDays?: number;
    adminNotes?: string;
  };

  if (!requestId || !action) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  if (action === "approve") {
    const days = trialDays ?? 14;
    if (days < 1 || days > 90) {
      return NextResponse.json({ error: "Durée d'essai invalide (1–90 jours)." }, { status: 400 });
    }

    const { data: reqRow } = await supabaseServer
      .from("pro_trial_requests")
      .select("contact_email, user_id")
      .eq("id", requestId)
      .maybeSingle();

    const result = await approveTrialRequest({
      requestId,
      adminUserId: user.id,
      trialDays: days,
      adminNotes,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const email = (reqRow as { contact_email?: string } | null)?.contact_email;
    const userId = (reqRow as { user_id?: string } | null)?.user_id;
    if (email && userId) {
      await notifyUserTrialApproved({ userId, to: email, trialDays: days });
    }

    await logAdminSupportActivity({
      authorId: user.id,
      action: "trial_request_approved",
      summary: `Demande d'essai approuvée (${days}j)`,
      metadata: { requestId, trialDays: days },
    });

    return NextResponse.json({ ok: true });
  }

  const result = await rejectTrialRequest({
    requestId,
    adminUserId: user.id,
    adminNotes,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logAdminSupportActivity({
    authorId: user.id,
    action: "trial_request_rejected",
    summary: "Demande d'essai refusée",
    metadata: { requestId },
  });

  return NextResponse.json({ ok: true });
}
