import "server-only";

import { cookies, headers } from "next/headers";

export const NATIVE_APP_COOKIE = "ubion_native";

/** Détecte une requête depuis l'app Capacitor (cookie posé au boot natif). */
export async function isNativeAppRequest(): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get(NATIVE_APP_COOKIE)?.value === "1") return true;

  const ua = (await headers()).get("user-agent") ?? "";
  return /\bCapacitor\b/i.test(ua);
}

export const NATIVE_BILLING_BLOCKED_MESSAGE =
  "Les abonnements et paiements se gèrent sur ubion.fr (navigateur web), conformément aux règles de l'App Store.";
