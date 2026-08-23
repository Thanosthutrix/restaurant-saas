import "server-only";

import { sendEmailViaResend } from "@/lib/messaging/resendSend";
import { sendPushToDevices } from "@/lib/push/pushSendService";
import { listPushTokensForPlatformAdmins } from "@/lib/push/pushTokenDb";
import { formatBillingOfferShort } from "@/lib/billing/config";

export async function notifyAdminPaymentFailed(params: {
  restaurantName: string;
  ownerEmail: string | null;
  restaurantId: string;
  status?: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? "medhi.thuleau@gmail.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.ubion.fr";

  const emailPromise = sendEmailViaResend({
    to: adminEmail,
    subject: `⚠️ Échec paiement Ubion : ${params.restaurantName}`,
    text: [
      "Un paiement d'abonnement Ubion a échoué.",
      "",
      `Restaurant   : ${params.restaurantName}`,
      `Propriétaire : ${params.ownerEmail ?? "—"}`,
      `Statut       : ${params.status ?? "past_due"}`,
      `Montant      : ~${formatBillingOfferShort()}`,
      "",
      `👉 Fiche admin : ${appUrl}/admin/restaurants/${params.restaurantId}`,
      `👉 Finances   : ${appUrl}/admin/finances`,
    ].join("\n"),
    fromDisplayName: "Ubion Admin",
  }).catch((err) => {
    console.error("[notifyPaymentFailed] email failed:", err);
  });

  const pushPromise = (async () => {
    const tokens = await listPushTokensForPlatformAdmins();
    if (tokens.length === 0) return;
    await sendPushToDevices({
      tokens,
      title: "Échec paiement",
      body: `${params.restaurantName} — abonnement en retard`,
      data: { type: "admin_payment_failed", restaurantId: params.restaurantId },
    });
  })().catch((err) => {
    console.error("[notifyPaymentFailed] push failed:", err);
  });

  await Promise.all([emailPromise, pushPromise]);
}
