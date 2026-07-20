"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        /* SW optionnel — ne pas bloquer l'app */
      });
  }, []);

  return null;
}
