import "server-only";

import { getPushServerStatus } from "./pushStatus";
import { listPushTokensForUser } from "./pushTokenDb";
import { sendPushToDevices } from "./pushSendService";

export async function sendTestPushToUser(userId: string): Promise<{
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
  details?: string[];
}> {
  const status = getPushServerStatus();
  if (!status.sendConfigured) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error:
        "APNs non configuré sur le serveur. Ajoutez APNS_KEY_ID, APNS_TEAM_ID et APNS_PRIVATE_KEY sur Vercel.",
    };
  }

  const tokens = await listPushTokensForUser(userId);
  if (tokens.length === 0) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error:
        "Aucun appareil enregistré. Ouvrez Ubion sur iPhone, acceptez les notifications, puis reconnectez-vous.",
    };
  }

  const result = await sendPushToDevices({
    tokens,
    title: "Ubion — test notification",
    body: "Les alertes push fonctionnent pour votre équipe.",
    data: { type: "test", url: "/communication" },
  });

  if (result.sent === 0) {
    return {
      ok: false,
      sent: 0,
      failed: result.failed,
      error:
        status.apnsSandbox === true
          ? "Envoi échoué. Vérifiez APNS_USE_SANDBOX=true (build Xcode) et la clé .p8 sur Vercel."
          : "Envoi échoué. Vérifiez la clé APNs (.p8), Key ID, Team ID et APNS_BUNDLE_ID=fr.ubion.app sur Vercel.",
    };
  }

  return { ok: true, sent: result.sent, failed: result.failed };
}
