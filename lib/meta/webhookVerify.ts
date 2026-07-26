import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { getMetaAppSecret } from "./config";

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getMetaAppSecret();
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  try {
    const a = Buffer.from(received, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
