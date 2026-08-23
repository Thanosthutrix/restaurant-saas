"use client";

import { useEffect } from "react";
import { MOBILE_SHELL_MQ } from "@/lib/app/mobileShell";

const ROOT_CLASS = "mobile-shell";

/** Bootstrap mobile web : classe shell + enregistrement PWA (service worker). */
export function MobileShellBootstrap() {
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SHELL_MQ);

    function sync() {
      document.documentElement.classList.toggle(ROOT_CLASS, mq.matches);
    }

    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.documentElement.classList.remove(ROOT_CLASS);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch(() => {
        /* SW optionnel — ne pas bloquer l'app */
      });
  }, []);

  return null;
}
