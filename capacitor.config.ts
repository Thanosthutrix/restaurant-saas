import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Lit `.env.local` pour `CAPACITOR_SERVER_URL` (sans écraser une var déjà définie). */
function applyEnvLocal() {
  const envPath = join(__dirname, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

applyEnvLocal();

/** URL chargée dans la WebView — un deploy web met à jour le site ET l'app native. */
const PRODUCTION_URL = "https://www.ubion.fr";
const serverUrl = (process.env.CAPACITOR_SERVER_URL ?? PRODUCTION_URL).replace(/\/$/, "");

const config: CapacitorConfig = {
  appId: "fr.ubion.app",
  appName: "ubion",
  webDir: "public",
  /** Fond WebView = gris ubion (évite le noir visible au rebond iOS). */
  backgroundColor: "#E9EDF2",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  ios: {
    /** "automatic" provoque un décalage/flottement en haut/bas au scroll. */
    contentInset: "never",
    allowsLinkPreview: false,
    /** Évite le rendu « desktop zoomé » dans la WebView iOS. */
    preferredContentMode: "mobile",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#9c431c",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#9c431c",
    },
  },
};

export default config;
