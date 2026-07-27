import "server-only";

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  privateKey: string;
  bundleId: string;
  useSandbox: boolean;
};

export type FcmConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\\n/g, "\n");
  if (!key.includes("BEGIN PRIVATE KEY") && /^MIGT[A-Za-z0-9+/=]+$/.test(key.replace(/\s/g, ""))) {
    key = `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }
  return key.trim();
}

export function getApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const privateKeyRaw = process.env.APNS_PRIVATE_KEY?.trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "fr.ubion.app";
  if (!keyId || !teamId || !privateKeyRaw) return null;

  const sandboxRaw = process.env.APNS_USE_SANDBOX?.trim().toLowerCase();
  const useSandbox = sandboxRaw === "1" || sandboxRaw === "true" || sandboxRaw === "yes";

  return {
    keyId,
    teamId,
    privateKey: normalizePrivateKey(privateKeyRaw),
    bundleId,
    useSandbox,
  };
}

export function getFcmConfig(): FcmConfig | null {
  const jsonRaw = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: normalizePrivateKey(parsed.private_key),
        };
      }
    } catch {
      return null;
    }
  }

  const projectId = process.env.FCM_PROJECT_ID?.trim();
  const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FCM_PRIVATE_KEY?.trim();
  if (!projectId || !clientEmail || !privateKeyRaw) return null;

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKeyRaw),
  };
}

export function isPushSendConfigured(): boolean {
  return Boolean(getApnsConfig() || getFcmConfig());
}
