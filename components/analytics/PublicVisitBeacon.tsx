"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Envoie une page vue au plus une fois par session navigateur et par chemin. */
export function PublicVisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || typeof window === "undefined") return;

    const key = `ubion_pv:${pathname}`;
    if (sessionStorage.getItem(key)) return;

    void fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ path: pathname }),
    })
      .then((res) => {
        if (res.ok) sessionStorage.setItem(key, "1");
      })
      .catch(() => undefined);
  }, [pathname]);

  return null;
}
