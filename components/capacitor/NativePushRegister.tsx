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

    // Les listeners DOIVENT être ajoutés avant register(), sinon le token peut être perdu.
    await PushNotifications.addListener("registration", async (event) => {
      const platform = Capacitor.getPlatform();
      if (platform !== "ios" && platform !== "android") return;

      try {
        const res = await fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token: event.value,
            platform,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          console.warn("[ubion push] register API:", json.error ?? res.status);
        }
      } catch (error) {
        console.warn("[ubion push] register API failed", error);
      }
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.warn("[ubion push] registration error", error);
    });

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("[ubion push] permission denied");
      return;
    }

    await PushNotifications.register();
  } catch (error) {
    console.warn("[ubion push] setup failed", error);
  }
}
