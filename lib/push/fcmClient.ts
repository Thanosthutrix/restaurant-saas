import "server-only";

import { createSign } from "node:crypto";
import type { FcmConfig } from "./pushConfig";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken(config: FcmConfig): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: config.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");
  const unsigned = `${header}.${claim}`;

  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign(config.privateKey).toString("base64url");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  cachedAccessToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  };
  return json.access_token;
}

export async function sendFcmPush(params: {
  config: FcmConfig;
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const accessToken = await getFcmAccessToken(params.config);
  if (!accessToken) {
    return { ok: false, reason: "FCM OAuth token unavailable." };
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${params.config.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: params.token,
          notification: { title: params.title, body: params.body },
          data: params.data ?? {},
        },
      }),
    }
  );

  if (res.ok) return { ok: true, status: res.status };

  const text = await res.text();
  let reason = text.slice(0, 300);
  try {
    reason = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? reason;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, reason };
}
