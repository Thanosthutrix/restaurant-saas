import "server-only";

import { metaGraphUrl } from "./config";

const WEBHOOK_SUBSCRIBED_FIELDS = ["messages", "messaging_postbacks"] as const;

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
    throw new Error(
      "Abonnement webhook Meta echoue (" + String(res.status) + ") : " + text.slice(0, 300)
    );
  }

  const json = (await res.json()) as { success?: boolean; error?: { message: string } };
  if (json.error) {
    throw new Error(json.error.message);
  }
  if (json.success === false) {
    throw new Error("Abonnement webhook Meta refuse.");
  }
}
