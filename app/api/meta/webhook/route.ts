import { NextResponse } from "next/server";
import { getMetaWebhookVerifyToken } from "@/lib/meta/config";
import { handleMetaWebhookPayload } from "@/lib/meta/webhookHandler";
import { verifyMetaWebhookSignature } from "@/lib/meta/webhookVerify";

export const dynamic = "force-dynamic";

/** Vérification + réception webhooks Meta (Messenger / Instagram DM). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = getMetaWebhookVerifyToken();
  if (mode === "subscribe" && token && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn("[meta/webhook] signature invalide");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await handleMetaWebhookPayload(body as Parameters<typeof handleMetaWebhookPayload>[0]);
  } catch (err) {
    console.error("[meta/webhook] handler error:", err);
  }

  return NextResponse.json({ ok: true });
}
