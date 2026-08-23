/**
 * POST /api/admin/prospect/invite
 * Régénère le lien d'invitation et envoie optionnellement l'email au prospect.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProspectAdminDetail, isCurrentUserAdmin, refreshProspectInviteRecord } from "@/lib/admin";
import { sendEmailViaResend } from "@/lib/messaging/resendSend";

export async function POST(req: NextRequest) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const { prospectId, sendEmail } = body as { prospectId?: string; sendEmail?: boolean };

  if (!prospectId) {
    return NextResponse.json({ error: "prospectId requis." }, { status: 400 });
  }

  const result = await refreshProspectInviteRecord(prospectId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (sendEmail) {
    const { prospect } = await getProspectAdminDetail(prospectId);
    if (prospect) {
      const displayName = prospect.contact_name?.trim() || prospect.contact_email;
      try {
        await sendEmailViaResend({
          to: prospect.contact_email,
          subject: "Votre invitation Ubion Pro",
          text: [
            `Bonjour ${displayName},`,
            "",
            "Voici votre lien d'invitation pour créer votre compte Ubion Pro :",
            result.inviteUrl,
            "",
            prospect.trial_days
              ? `Un essai de ${prospect.trial_days} jours sera activé automatiquement à l'inscription.`
              : "",
            "",
            "À bientôt sur Ubion !",
          ]
            .filter(Boolean)
            .join("\n"),
          fromDisplayName: "Ubion",
        });
      } catch (err) {
        console.error("[admin/prospect/invite] email failed:", err);
      }
    }
  }

  return NextResponse.json({ ok: true, inviteUrl: result.inviteUrl, expiresAt: result.expiresAt });
}
