import "server-only";

const APNS_HINTS: Record<string, string> = {
  BadEnvironmentKeyInToken:
    "Sandbox / production incompatible : mettez APNS_USE_SANDBOX=true sur Vercel si vous testez via Xcode, ou false en TestFlight.",
  BadDeviceToken:
    "Token iPhone invalide — fermez Ubion, rouvrez l'app, acceptez les notifications, reconnectez-vous.",
  DeviceTokenNotForTopic:
    "APNS_BUNDLE_ID doit être fr.ubion.app (identique au bundle Xcode).",
  TopicDisallowed:
    "APNS_BUNDLE_ID incorrect ou clé APNs sans accès à cette app.",
  InvalidProviderToken:
    "Clé .p8, APNS_KEY_ID ou APNS_TEAM_ID incorrect. Vérifiez le format de APNS_PRIVATE_KEY (\\n pour les retours ligne).",
  ExpiredProviderToken: "JWT APNs expiré — réessayez (rare, redéploiement Vercel si persistant).",
  Forbidden: "La clé APNs n'a pas les droits push pour cette app Apple.",
};

export function explainApnsFailure(reason: string | undefined, useSandbox: boolean | null): string {
  if (!reason) {
    return useSandbox
      ? "Envoi APNs échoué (sandbox). Vérifiez APNS_USE_SANDBOX=true et la clé .p8."
      : "Envoi APNs échoué. Vérifiez la clé .p8 et APNS_BUNDLE_ID=fr.ubion.app.";
  }

  const hint = APNS_HINTS[reason];
  if (hint) return `${reason} — ${hint}`;

  return reason;
}
