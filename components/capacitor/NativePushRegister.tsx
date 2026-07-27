"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/capacitor/platform";
import {
  retryPendingPushRegistration,
  sendPushTokenToServer,
} from "@/lib/push/registerPushTokenClient";

/**
 * Enregistre le token push natif (FCM/APNs) côté serveur.
 * Ne s'exécute que dans l'app Capacitor, pas dans le navigateur.
 */
export function NativePushRegister() {
  const listenersReadyRef = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    void ensureNativePushRegistration(listenersReadyRef);
    void retryPendingPushRegistration();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        void retryPendingPushRegistration();
      }
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void ensureNativePushRegistration(listenersReadyRef);
        void retryPendingPushRegistration();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

async function ensureNativePushRegistration(listenersReadyRef: {
  current: boolean;
}): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const { PushNotifications } = await import("@capacitor/push-notifications");

    if (!listenersReadyRef.current) {
      await PushNotifications.addListener("registration", async (event) => {
        const platform = Capacitor.getPlatform();
        if (platform !== "ios" && platform !== "android") return;
        await sendPushTokenToServer(event.value, platform);
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.warn("[ubion push] registration error", error);
      });

      listenersReadyRef.current = true;
    }

    const perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      const requested = await PushNotifications.requestPermissions();
      if (requested.receive !== "granted") {
        console.warn("[ubion push] permission denied");
        return;
      }
    } else if (perm.receive !== "granted") {
      console.warn("[ubion push] permission not granted:", perm.receive);
      return;
    }

    await PushNotifications.register();
  } catch (error) {
    console.warn("[ubion push] setup failed", error);
  }
}
