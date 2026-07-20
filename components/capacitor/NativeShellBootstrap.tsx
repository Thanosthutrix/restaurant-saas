"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/capacitor/platform";
import { NativePushRegister } from "@/components/capacitor/NativePushRegister";

/** Initialise plugins natifs Capacitor (barre de statut, push…). */
export function NativeShellBootstrap() {
  useEffect(() => {
    if (!isNativeApp()) return;
    void configureNativeShell();
  }, []);

  return <NativePushRegister />;
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
