"use client";

import { useEffect } from "react";
import { MOBILE_SHELL_MQ } from "@/lib/app/mobileShell";

const ROOT_CLASS = "mobile-shell";

/** Applique la classe `mobile-shell` sur mobile web (même chrome que l'app native). */
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

  return null;
}
