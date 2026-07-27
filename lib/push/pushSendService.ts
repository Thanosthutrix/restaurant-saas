import "server-only";

import { sendApnsPush } from "./apnsClient";
import { sendFcmPush } from "./fcmClient";
import { getApnsConfig, getFcmConfig } from "./pushConfig";
import { deletePushToken, type PushTokenRow } from "./pushTokenDb";

export async function sendPushToDevice(params: {
  token: PushTokenRow;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ ok: boolean; reason?: string }> {
  if (params.token.platform === "ios") {
    const apns = getApnsConfig();
    if (!apns) return { ok: false, reason: "APNs non configuré." };

    const result = await sendApnsPush({
      config: apns,
      deviceToken: params.token.token,
      title: params.title,
      body: params.body,
      data: params.data,
    });

    if (!result.ok && (result.reason === "BadDeviceToken" || result.reason === "Unregistered")) {
      await deletePushToken(params.token.token);
    }
    return { ok: result.ok, reason: result.reason };
  }

  if (params.token.platform === "android") {
    const fcm = getFcmConfig();
    if (!fcm) return { ok: false, reason: "FCM non configuré." };

    const result = await sendFcmPush({
      config: fcm,
      token: params.token.token,
      title: params.title,
      body: params.body,
      data: params.data,
    });

    if (
      !result.ok &&
      result.reason &&
      /not found|invalid|unregistered/i.test(result.reason)
    ) {
      await deletePushToken(params.token.token);
    }
    return { ok: result.ok, reason: result.reason };
  }

  return { ok: false, reason: "Plateforme non supportée." };
}

export async function sendPushToDevices(params: {
  tokens: PushTokenRow[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ sent: number; failed: number; failures: { platform: string; reason?: string }[] }> {
  let sent = 0;
  let failed = 0;
  const failures: { platform: string; reason?: string }[] = [];

  for (const token of params.tokens) {
    try {
      const result = await sendPushToDevice({
        token,
        title: params.title,
        body: params.body,
        data: params.data,
      });
      if (result.ok) sent += 1;
      else {
        failed += 1;
        failures.push({ platform: token.platform, reason: result.reason });
      }
    } catch (err) {
      failed += 1;
      failures.push({
        platform: token.platform,
        reason: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  return { sent, failed, failures };
}
