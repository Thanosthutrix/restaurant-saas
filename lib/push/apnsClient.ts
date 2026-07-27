import "server-only";

import { createSign } from "node:crypto";
import http2 from "node:http2";
import type { ApnsConfig } from "./pushConfig";

let cachedJwt: { token: string; expiresAt: number } | null = null;

function buildApnsJwt(config: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt > now + 60) {
    return cachedJwt.token;
  }

  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: config.keyId })).toString(
    "base64url"
  );
  const payload = Buffer.from(JSON.stringify({ iss: config.teamId, iat: now })).toString(
    "base64url"
  );
  const unsigned = `${header}.${payload}`;

  const sign = createSign("SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = sign
    .sign({ key: config.privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");

  const token = `${unsigned}.${signature}`;
  cachedJwt = { token, expiresAt: now + 50 * 60 };
  return token;
}

function normalizeDeviceToken(token: string): string {
  return token.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
}

export function validateApnsCredentials(config: ApnsConfig): { ok: boolean; error?: string } {
  try {
    buildApnsJwt(config);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible de signer le JWT APNs.",
    };
  }
}

export async function sendApnsPush(params: {
  config: ApnsConfig;
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const deviceToken = normalizeDeviceToken(params.deviceToken);
  if (deviceToken.length < 32) {
    return { ok: false, reason: "BadDeviceToken" };
  }

  const host = params.config.useSandbox
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";

  const jwt = buildApnsJwt(params.config);
  const payload = {
    aps: {
      alert: { title: params.title, body: params.body },
      sound: "default",
    },
    ...params.data,
  };

  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", (err) => {
      client.close();
      resolve({ ok: false, reason: err.message });
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": params.config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });

    let responseBody = "";
    req.on("response", (headers) => {
      const status = Number(headers[":status"] ?? 0);
      req.on("data", (chunk) => {
        responseBody += String(chunk);
      });
      req.on("end", () => {
        client.close();
        if (status === 200) {
          resolve({ ok: true, status });
          return;
        }
        let reason = responseBody;
        try {
          reason = (JSON.parse(responseBody) as { reason?: string }).reason ?? responseBody;
        } catch {
          /* ignore */
        }
        resolve({ ok: false, status, reason });
      });
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}
