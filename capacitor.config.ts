import type { CapacitorConfig } from "@capacitor/cli";

/** URL chargée dans la WebView — un deploy web met à jour le site ET l'app native. */
const PRODUCTION_URL = "https://www.ubion.fr";
const serverUrl = (process.env.CAPACITOR_SERVER_URL ?? PRODUCTION_URL).replace(/\/$/, "");

const config: CapacitorConfig = {
  appId: "fr.ubion.app",
  appName: "ubion",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
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
