"use client";

import { useEffect, useRef } from "react";
import { dispatchMetaMessagingSynced } from "@/lib/meta/metaMessagingSyncEvent";

const POLL_MS = 15_000;

type Props = {
  restaurantId: string | null;
};

/**
 * Sync Meta DM en arrière-plan tant que l'app Ubion est ouverte
 * (bot + inbox, sans ouvrir l'onglet Messages).
 */
export function MetaMessagingBackgroundSync({ restaurantId }: Props) {
  const busyRef = useRef(false);

  useEffect(() => {
    if (!restaurantId) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || busyRef.current) return;
      if (document.visibilityState === "hidden") return;
      busyRef.current = true;
      try {
        const res = await fetch("/api/meta/messaging/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ restaurantId }),
        });
        if (res.ok) dispatchMetaMessagingSynced();
      } catch {
        /* ignore — prochain tick */
      } finally {
        busyRef.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    const onWake = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [restaurantId]);

  return null;
}
