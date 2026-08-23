import { createHmac, timingSafeEqual } from "crypto";

function getStateSecret(): string {
  return (
    process.env.SUPER_PDP_OAUTH_STATE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "dev-pa-oauth-state"
  );
}

/** Restaurant (legacy) ou société Ubion (platform). */
export type PaOAuthState =
  | { scope?: "restaurant"; restaurantId: string; userId: string; ts: number }
  | { scope: "platform"; companyId: string; userId: string; ts: number };

export function encodePaOAuthState(payload: PaOAuthState): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function decodePaOAuthState(raw: string): PaOAuthState | null {
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", getStateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PaOAuthState;
    if (!parsed.userId || !parsed.ts) return null;
    if (Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    if ("companyId" in parsed && parsed.scope === "platform" && parsed.companyId) return parsed;
    if ("restaurantId" in parsed && parsed.restaurantId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function isPlatformPaOAuthState(state: PaOAuthState): state is Extract<PaOAuthState, { scope: "platform" }> {
  return state.scope === "platform" && "companyId" in state;
}
