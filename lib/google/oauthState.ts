import { createHmac, timingSafeEqual } from "crypto";

function getStateSecret(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "dev-google-oauth-state"
  );
}

export type GoogleOAuthState = {
  restaurantId: string;
  userId: string;
  ts: number;
};

export function encodeGoogleOAuthState(payload: GoogleOAuthState): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function decodeGoogleOAuthState(raw: string): GoogleOAuthState | null {
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GoogleOAuthState;
    if (!parsed.restaurantId || !parsed.userId || !parsed.ts) return null;
    if (Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
