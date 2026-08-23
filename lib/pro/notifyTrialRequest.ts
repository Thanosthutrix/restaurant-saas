import "server-only";

import { sendEmailViaResend } from "@/lib/messaging/resendSend";
import { sendPushToDevices } from "@/lib/push/pushSendService";
import { listPushTokensForPlatformAdmins, listPushTokensForUser } from "@/lib/push/pushTokenDb";

export async function notifyAdminTrialRequest(params: {
  contactEmail: string;
  restaurantName: string | null;
  message: string | null;
  requestId: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL ?? "medhi.thuleau@gmail.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ubion.fr";

  const emailPromise = sendEmailViaResend({
    to: adminEmail,
    subject: `[Action requise] Demande d'essai Ubion Pro — ${params.restaurantName ?? params.contactEmail}`,
    text: [
      "⚠️ Nouvelle demande d'essai Ubion Pro",
      "",
      "Un restaurateur souhaite tester Ubion Pro et attend votre validation.",
      "",
      `Email         : ${params.contactEmail}`,
      `Établissement : ${params.restaurantName ?? "—"}`,
      params.message ? `Message       : ${params.message}` : null,
      "",
      `Traiter la demande : ${appUrl}/admin/trial-requests`,
      "",
      "— Ubion Admin",
    ]
      .filter(Boolean)
      .join("\n"),
    fromDisplayName: "Ubion Admin",
  }).catch((err) => {
    console.error("[notifyAdminTrialRequest] email failed:", err);
  });

  const pushPromise = (async () => {
    const tokens = await listPushTokensForPlatformAdmins();
    if (tokens.length === 0) return;
    await sendPushToDevices({
      tokens,
      title: "⚠️ Demande d'essai Pro",
      body: `${params.restaurantName ?? params.contactEmail} — action requise`,
      data: { type: "admin_trial_request", requestId: params.requestId, url: "/admin/trial-requests" },
    });
  })().catch((err) => {
    console.error("[notifyAdminTrialRequest] push failed:", err);
  });

  await Promise.all([emailPromise, pushPromise]);
}

export async function notifyUserTrialApproved(params: {
  userId: string;
  to: string;
  trialDays: number;
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ubion.fr";

  const emailPromise = sendEmailViaResend({
    to: params.to,
    subject: "Votre essai Ubion Pro est activé",
    text: [
      "Bonne nouvelle — votre demande d'essai Ubion Pro a été acceptée.",
      "",
      `Durée : ${params.trialDays} jours à compter de la création de votre établissement.`,
      "",
      `👉 Créez votre restaurant : ${appUrl}/onboarding`,
      "",
      "À bientôt sur Ubion.",
    ].join("\n"),
    fromDisplayName: "Ubion",
  }).catch((err) => {
    console.error("[notifyUserTrialApproved] email failed:", err);
  });

  const pushPromise = (async () => {
    const tokens = await listPushTokensForUser(params.userId);
    if (tokens.length === 0) return;
    await sendPushToDevices({
      tokens,
      title: "Essai Ubion Pro activé",
      body: `Votre essai de ${params.trialDays} jours est prêt — créez votre établissement.`,
      data: { type: "trial_approved", url: "/onboarding" },
    });
  })().catch((err) => {
    console.error("[notifyUserTrialApproved] push failed:", err);
  });

  await Promise.all([emailPromise, pushPromise]);
}
