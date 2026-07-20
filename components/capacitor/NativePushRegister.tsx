"use client";

import { useEffect, useRef } from "react";
import { isNativeApp } from "@/lib/capacitor/platform";

/**
 * Enregistre le token push natif (FCM/APNs) côté serveur.
 * Ne s'exécute que dans l'app Capacitor, pas dans le navigateur.
 */
export function NativePushRegister() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isNativeApp() || startedRef.current) return;
    startedRef.current = true;
    void setupNativePush();
  }, []);

  return null;
}

async function setupNativePush() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;

    await PushNotifications.register();

    await PushNotifications.addListener("registration", async (event) => {
      const platform = Capacitor.getPlatform();
      if (platform !== "ios" && platform !== "android") return;

      await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token: event.value,
          platform,
        }),
      });
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.warn("[ubion push] registration error", error);
    });
  } catch (error) {
    console.warn("[ubion push] setup failed", error);
  }
}
