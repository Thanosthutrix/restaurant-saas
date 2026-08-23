import "server-only";

import { sendEmailViaResend } from "@/lib/messaging/resendSend";
import { sendPushToDevices } from "@/lib/push/pushSendService";
import { listPushTokensForPlatformAdmins } from "@/lib/push/pushTokenDb";

export async function notifyAdminNewProspect(params: {
  contactName: string | null;
  contactEmail: string;
  restaurantName: string | null;
  source: string;
  prospectId: string;
  appUrl?: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? "medhi.thuleau@gmail.com";
  const appUrl = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.ubion.fr";
  const displayName = params.contactName?.trim() || params.contactEmail;
  const restaurantLabel = params.restaurantName?.trim() || "—";

  const emailPromise = sendEmailViaResend({
    to: adminEmail,
    subject: `📋 Nouveau prospect Ubion : ${displayName}`,
    text: [
      "Un nouveau prospect a été ajouté au CRM Ubion.",
      "",
      `Contact       : ${displayName}`,
      `Email         : ${params.contactEmail}`,
      `Restaurant    : ${restaurantLabel}`,
      `Source        : ${params.source}`,
      "",
      `👉 Fiche CRM : ${appUrl}/admin/prospects/${params.prospectId}`,
    ].join("\n"),
    fromDisplayName: "Ubion Admin",
  }).catch((err) => {
    console.error("[notifyNewProspect] email failed:", err);
  });

  const pushPromise = (async () => {
    const tokens = await listPushTokensForPlatformAdmins();
    if (tokens.length === 0) return;
    await sendPushToDevices({
      tokens,
      title: "Nouveau prospect",
      body: `${displayName} — ${restaurantLabel}`,
      data: { type: "admin_prospect", prospectId: params.prospectId },
    });
  })().catch((err) => {
    console.error("[notifyNewProspect] push failed:", err);
  });

  await Promise.all([emailPromise, pushPromise]);
}
