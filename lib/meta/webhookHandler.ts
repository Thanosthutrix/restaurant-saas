import "server-only";

import {
  findRestaurantIdByFacebookPageId,
  findRestaurantIdByInstagramAccountId,
  recordOutboundMetaMessage,
  upsertInboundMetaMessage,
} from "./messagingDb";
import type { MetaMessagingPlatform } from "./messagingTypes";

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    attachments?: unknown[];
    is_echo?: boolean;
    is_deleted?: boolean;
  };
};

type WebhookEntry = {
  id?: string;
  time?: number;
  messaging?: MessagingEvent[];
};

type MetaWebhookBody = {
  object?: string;
  entry?: WebhookEntry[];
};

async function resolveRestaurantId(
  objectType: string,
  entryId: string
): Promise<string | null> {
  if (objectType === "instagram") {
    const byIg = await findRestaurantIdByInstagramAccountId(entryId);
    if (byIg) return byIg;
    return findRestaurantIdByFacebookPageId(entryId);
  }
  const byPage = await findRestaurantIdByFacebookPageId(entryId);
  if (byPage) return byPage;
  return findRestaurantIdByInstagramAccountId(entryId);
}

function resolvePlatform(objectType: string): MetaMessagingPlatform {
  return objectType === "instagram" ? "instagram_dm" : "facebook_messenger";
}

async function handleMessagingEvent(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  event: MessagingEvent;
}): Promise<void> {
  const message = params.event.message;
  if (!message || message.is_deleted) return;

  const senderId = params.event.sender?.id;
  const recipientId = params.event.recipient?.id;
  if (!senderId) return;

  const isEcho = Boolean(message.is_echo);
  const externalUserId = isEcho ? recipientId : senderId;
  if (!externalUserId) return;

  const payload = {
    restaurantId: params.restaurantId,
    platform: params.platform,
    externalUserId,
    metaMessageId: message.mid ?? null,
    text: message.text ?? null,
    attachments: message.attachments ?? null,
    rawPayload: params.event,
  };

  if (isEcho) {
    await recordOutboundMetaMessage(payload);
  } else {
    await upsertInboundMetaMessage({ ...payload, incrementUnread: true });
  }
}

export async function handleMetaWebhookPayload(body: MetaWebhookBody): Promise<void> {
  const objectType = body.object ?? "page";
  const entries = body.entry ?? [];

  for (const entry of entries) {
    const entryId = entry.id;
    if (!entryId) continue;

    const restaurantId = await resolveRestaurantId(objectType, entryId);
    if (!restaurantId) {
      console.warn("[meta/webhook] restaurant introuvable pour entry", entryId, objectType);
      continue;
    }

    const platform = resolvePlatform(objectType);
    for (const event of entry.messaging ?? []) {
      try {
        await handleMessagingEvent({ restaurantId, platform, event });
      } catch (err) {
        console.error("[meta/webhook] message non enregistré:", err);
      }
    }
  }
}
