import "server-only";

import { getApnsConfig, getFcmConfig } from "./pushConfig";
import { listPushTokensForRestaurant } from "./pushTokenDb";

export type PushServerStatus = {
  apnsConfigured: boolean;
  fcmConfigured: boolean;
  sendConfigured: boolean;
  /** Sandbox APNs (build Xcode) — doit correspondre au type de token enregistré. */
  apnsSandbox: boolean | null;
  teamTokenCount: number;
};

export function getPushServerStatus(): Omit<PushServerStatus, "teamTokenCount"> {
  const apns = getApnsConfig();
  const fcm = getFcmConfig();
  return {
    apnsConfigured: Boolean(apns),
    fcmConfigured: Boolean(fcm),
    sendConfigured: Boolean(apns || fcm),
    apnsSandbox: apns?.useSandbox ?? null,
  };
}

export async function getPushStatusForRestaurant(
  restaurantId: string
): Promise<PushServerStatus> {
  const base = getPushServerStatus();
  const tokens = await listPushTokensForRestaurant(restaurantId);
  return { ...base, teamTokenCount: tokens.length };
}
