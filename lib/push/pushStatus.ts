import "server-only";

import { validateApnsCredentials } from "./apnsClient";
import { getApnsConfig, getFcmConfig } from "./pushConfig";
import { listPushTokensForRestaurant } from "./pushTokenDb";

export type PushServerStatus = {
  apnsConfigured: boolean;
  fcmConfigured: boolean;
  sendConfigured: boolean;
  apnsSandbox: boolean | null;
  apnsBundleId: string | null;
  /** JWT APNs signé avec succès (clé .p8 valide). */
  apnsJwtValid: boolean | null;
  apnsJwtError: string | null;
  teamTokenCount: number;
};

export function getPushServerStatus(): Omit<PushServerStatus, "teamTokenCount"> {
  const apns = getApnsConfig();
  const fcm = getFcmConfig();
  let apnsJwtValid: boolean | null = null;
  let apnsJwtError: string | null = null;

  if (apns) {
    const check = validateApnsCredentials(apns);
    apnsJwtValid = check.ok;
    apnsJwtError = check.error ?? null;
  }

  return {
    apnsConfigured: Boolean(apns),
    fcmConfigured: Boolean(fcm),
    sendConfigured: Boolean(apns || fcm),
    apnsSandbox: apns?.useSandbox ?? null,
    apnsBundleId: apns?.bundleId ?? null,
    apnsJwtValid,
    apnsJwtError,
  };
}

export async function getPushStatusForRestaurant(
  restaurantId: string
): Promise<PushServerStatus> {
  const base = getPushServerStatus();
  const tokens = await listPushTokensForRestaurant(restaurantId);
  return { ...base, teamTokenCount: tokens.length };
}
