/**
 * POST /api/admin/email/send
 * Envoie un email support depuis l'espace admin (templates Resend).
 */

import { NextRequest, NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import type { AdminEmailTemplateId } from "@/lib/admin/supportTypes";
import { getCurrentUser } from "@/lib/auth";
import { buildAdminSupportEmail } from "@/lib/messaging/adminEmailTemplates";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";
import { supabaseServer } from "@/lib/supabaseServer";

const VALID_TEMPLATES: AdminEmailTemplateId[] = [
  "follow_up",
  "onboarding_checkin",
  "trial_expiring",
  "payment_help",
  "custom",
];

export async function POST(req: NextRequest) {
  const [isAdmin, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const {
    restaurantId,
    templateId,
    to,
    subject,
    text,
    contactName,
  } = body as {
    restaurantId?: string;
    templateId?: AdminEmailTemplateId;
    to?: string;
    subject?: string;
    text?: string;
    contactName?: string;
  };

  if (!restaurantId || !templateId || !VALID_TEMPLATES.includes(templateId)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const { data: rest } = await supabaseServer
    .from("restaurants")
    .select("name, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!rest) {
    return NextResponse.json({ error: "Restaurant introuvable." }, { status: 404 });
  }

  let ownerEmail: string | null = null;
  let ownerName: string | null = contactName?.trim() || null;
  if (rest.owner_id) {
    const { data } = await supabaseServer.auth.admin.getUserById(rest.owner_id as string);
    ownerEmail = data?.user?.email ?? null;
    if (!ownerName) {
      ownerName =
        (data?.user?.user_metadata?.full_name as string | undefined) ??
        (data?.user?.user_metadata?.name as string | undefined) ??
        null;
    }
  }

  const recipient = to?.trim() || ownerEmail;
  if (!recipient) {
    return NextResponse.json({ error: "Destinataire introuvable." }, { status: 400 });
  }

  const built = buildAdminSupportEmail(templateId, {
    contactName: ownerName ?? recipient.split("@")[0],
    restaurantName: rest.name as string,
    ownerEmail: recipient,
  });

  const finalSubject = (subject?.trim() || built.subject).trim();
  const finalText = (text?.trim() || built.text).trim();

  if (!finalSubject || !finalText) {
    return NextResponse.json({ error: "Sujet et message requis." }, { status: 400 });
  }

  try {
    const result = await sendEmailViaResend({
      to: recipient,
      subject: finalSubject,
      text: finalText,
      fromDisplayName: "Ubion",
    });

    await logAdminSupportActivity({
      authorId: user.id,
      restaurantId,
      action: "email_sent",
      summary: `Email « ${finalSubject} » → ${recipient}`,
      metadata: {
        templateId,
        to: recipient,
        resendId: result.id,
      },
    });

    return NextResponse.json({ ok: true, resendId: result.id });
  } catch (err) {
    console.error("[admin/email/send]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Envoi impossible." },
      { status: 500 }
    );
  }
}
