import "server-only";

import { metaGraphUrl } from "./config";

const WEBHOOK_SUBSCRIBED_FIELDS = ["messages", "messaging_postbacks"] as const;

export function formatMetaMessagingSubscribeError(raw: string): string {
  if (raw.includes("pages_messaging")) {
    return (
      "Permissions messagerie manquantes sur le jeton de la page (pages_messaging). " +
      "Reconnectez Meta via « Reconnecter et sélectionner ma page », puis reliez la page Facebook."
    );
  }
  if (raw.includes("pages_manage_metadata")) {
    return (
      "Permission pages_manage_metadata manquante. Reconnectez Meta avec les scopes messagerie activés."
    );
  }
  return raw;
}

export async function subscribePageMessagingWebhooks(params: {
  facebookPageId: string;
  pageAccessToken: string;
}): Promise<void> {
  const path = params.facebookPageId + "/subscribed_apps";
  const url = new URL(metaGraphUrl(path));
  url.searchParams.set("subscribed_fields", WEBHOOK_SUBSCRIBED_FIELDS.join(","));
  url.searchParams.set("access_token", params.pageAccessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatMetaMessagingSubscribeError(text.slice(0, 400)));
  }

  const json = (await res.json()) as { success?: boolean; error?: { message: string } };
  if (json.error) {
    throw new Error(formatMetaMessagingSubscribeError(json.error.message));
  }
  if (json.success === false) {
    throw new Error("Abonnement webhook Meta refuse.");
  }
}

export async function sendMetaTextMessage(params: {
  facebookPageId: string;
  pageAccessToken: string;
  recipientId: string;
  text: string;
}): Promise<{ messageId: string | null }> {
  const url = new URL(metaGraphUrl(`${params.facebookPageId}/messages`));
  url.searchParams.set("access_token", params.pageAccessToken);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: params.recipientId },
      messaging_type: "RESPONSE",
      message: { text: params.text.slice(0, 2000) },
    }),
  });

  const json = (await res.json()) as {
    message_id?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message ?? `Envoi Meta impossible (${res.status}).`);
  }

  return { messageId: json.message_id ?? null };
}
