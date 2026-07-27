import "server-only";

import type { MetaMessagingPlatform } from "@/lib/meta/messagingTypes";
import { isPushSendConfigured } from "./pushConfig";
import { listPushTokensForRestaurant } from "./pushTokenDb";
import { sendPushToDevices } from "./pushSendService";

function platformLabel(platform: MetaMessagingPlatform): string {
  return platform === "instagram_dm" ? "Instagram" : "Messenger";
}

function formatMessagePreview(text: string | null, hasAttachments?: boolean): string {
  const trimmed = text?.trim();
  if (trimmed) {
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
  }
  if (hasAttachments) return "Pièce jointe";
  return "Nouveau message";
}

/** Notifie l'équipe (app native) qu'un nouveau message client est arrivé via DM Meta. */
export async function notifyTeamMetaMessageReceived(params: {
  restaurantId: string;
  conversationId: string;
  platform: MetaMessagingPlatform;
  contactName: string | null;
  text: string | null;
  hasAttachments?: boolean;
}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!isPushSendConfigured()) {
    console.warn("[push] notifyTeamMetaMessageReceived: APNs/FCM non configuré sur le serveur");
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await listPushTokensForRestaurant(params.restaurantId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const channel = platformLabel(params.platform);
  const sender = params.contactName?.trim() || "Client";
  const preview = formatMessagePreview(params.text, params.hasAttachments);

  const result = await sendPushToDevices({
    tokens,
    title: `${sender} · ${channel}`,
    body: preview,
    data: {
      type: "meta_message",
      conversationId: params.conversationId,
      restaurantId: params.restaurantId,
      url: "/communication",
    },
  });

  if (result.sent === 0 && result.failed > 0) {
    console.warn("[push] notifyTeamMetaMessageReceived: aucun envoi réussi", {
      restaurantId: params.restaurantId,
      conversationId: params.conversationId,
      failed: result.failed,
    });
  }

  return { ...result, skipped: false };
}
