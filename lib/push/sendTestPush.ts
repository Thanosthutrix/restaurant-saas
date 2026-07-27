import "server-only";

import { explainApnsFailure } from "./apnsErrors";
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
        "APNs non configuré sur le serveur. Vérifiez APNS_KEY_ID, APNS_TEAM_ID et APNS_PRIVATE_KEY sur Vercel (environnement Production).",
    };
  }

  if (status.apnsJwtValid === false) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: `Clé APNs illisible sur le serveur : ${status.apnsJwtError ?? "format APNS_PRIVATE_KEY incorrect"}.`,
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
    const details = result.failures.map((f) =>
      explainApnsFailure(f.reason, status.apnsSandbox)
    );
    return {
      ok: false,
      sent: 0,
      failed: result.failed,
      error: details[0] ?? "Envoi APNs échoué.",
      details,
    };
  }

  return { ok: true, sent: result.sent, failed: result.failed };
}
