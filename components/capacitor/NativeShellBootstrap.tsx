"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/capacitor/platform";
import { NativePushRegister } from "@/components/capacitor/NativePushRegister";

/** Initialise plugins natifs Capacitor (barre de statut, push…). */
export function NativeShellBootstrap() {
  useEffect(() => {
    if (!isNativeApp()) return;
    applyNativeViewportFix();
    void configureNativeShell();
  }, []);

  return <NativePushRegister />;
}

function applyNativeViewportFix() {
  document.documentElement.classList.add("capacitor-native");

  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "viewport");
    document.head.appendChild(meta);
  }
  meta.setAttribute(
    "content",
    "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
  );
}

async function configureNativeShell() {
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
  } catch {
    /* optionnel */
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* optionnel */
  }
}
