"use client";

import { useEffect, useRef } from "react";
import { isNativeApp } from "@/lib/capacitor/platform";

/**
 * Enregistre le token push natif (FCM/APNs) côté serveur.
 * Ne s'exécute que dans l'app Capacitor, pas dans le navigateur.
 */
export function NativePushRegister() {
  const listenersReadyRef = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    void ensureNativePushRegistration(listenersReadyRef);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void ensureNativePushRegistration(listenersReadyRef);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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
        await sendTokenToServer(event.value, Capacitor.getPlatform());
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

async function sendTokenToServer(token: string, platform: string): Promise<void> {
  if (platform !== "ios" && platform !== "android") return;
  if (!token || token.length < 8) return;

  try {
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, platform }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      console.warn("[ubion push] register API:", json.error ?? res.status);
    }
  } catch (error) {
    console.warn("[ubion push] register API failed", error);
  }
}
