/** Détecte l'exécution dans la coque Capacitor (app iOS/Android). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  if (p === "ios" || p === "android") return p;
  return "web";
}
