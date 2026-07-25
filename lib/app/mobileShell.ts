import { isNativeApp } from "@/lib/capacitor/platform";

/** Même seuil que la barre du bas (`lg:hidden` / sidebar `lg:flex`). */
export const MOBILE_SHELL_MQ = "(max-width: 1023px)";

/** Navigation type app (barre du bas, feuille Plus, swipe retour). */
export function usesMobileShellChrome(): boolean {
  if (typeof window === "undefined") return false;
  return isNativeApp() || window.matchMedia(MOBILE_SHELL_MQ).matches;
}
