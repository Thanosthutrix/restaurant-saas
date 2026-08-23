/**
 * POST /api/admin/prospect
 * Crée un prospect CRM + notification admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { createProspectRecord, isCurrentUserAdmin } from "@/lib/admin";
import { logAdminSupportActivity } from "@/lib/admin/supportActivityDb";
import { getCurrentUser } from "@/lib/auth";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";

export async function POST(req: NextRequest) {
  const [isAdmin, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const {
    contactName,
    contactEmail,
    restaurantName,
    phone,
    source,
    notes,
    trialDays,
    sendInvite,
    sendInviteEmail,
  } = body as {
    contactName?: string;
    contactEmail?: string;
    restaurantName?: string;
    phone?: string;
    source?: string;
    notes?: string;
    trialDays?: number | null;
    sendInvite?: boolean;
    sendInviteEmail?: boolean;
  };

  if (!contactEmail?.trim()) {
    return NextResponse.json({ error: "Email requis." }, { status: 400 });
  }

  const result = await createProspectRecord({
    contactName,
    contactEmail,
    restaurantName,
    phone,
    source,
    notes,
    trialDays: trialDays ?? 14,
    createdByUserId: user.id,
    sendInvite: sendInvite ?? true,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (sendInviteEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.ubion.fr";
    const displayName = result.prospect.contact_name?.trim() || result.prospect.contact_email;
    try {
      await sendEmailViaResend({
        to: result.prospect.contact_email,
        subject: "Votre invitation Ubion Pro",
        text: [
          `Bonjour ${displayName},`,
          "",
          "Medhi vous invite à découvrir Ubion Pro, la plateforme de gestion pour restaurateurs.",
          "",
          "Créez votre compte et configurez votre établissement en quelques minutes :",
          result.inviteUrl,
          "",
          result.prospect.trial_days
            ? `Un essai de ${result.prospect.trial_days} jours sera activé automatiquement à l'inscription.`
            : "",
          "",
          "À bientôt sur Ubion !",
        ]
          .filter(Boolean)
          .join("\n"),
        fromDisplayName: "Ubion",
      });
    } catch (err) {
      console.error("[admin/prospect] invite email failed:", err);
    }
  }

  await logAdminSupportActivity({
    authorId: user.id,
    prospectId: result.prospect.id,
    action: "prospect_created",
    summary: `Prospect créé : ${result.prospect.contact_email}`,
    metadata: {
      contactName: result.prospect.contact_name,
      restaurantName: result.prospect.restaurant_name,
      sendInviteEmail: Boolean(sendInviteEmail),
    },
  });

  return NextResponse.json({
    ok: true,
    prospectId: result.prospect.id,
    inviteUrl: result.inviteUrl,
  });
}
