import "server-only";

import { notifyTeamMetaMessageReceived } from "@/lib/push/notifyMetaMessage";
import { processInboundMetaBookingBot } from "./bookingBot";
import {
  findRestaurantIdByFacebookPageId,
  findRestaurantIdByInstagramAccountId,
  getMetaConversationByPeer,
  recordOutboundMetaMessage,
  upsertInboundMetaMessage,
} from "./messagingDb";
import type { MetaMessagingPlatform } from "./messagingTypes";

type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  postback?: { payload?: string; title?: string };
  message?: {
    mid?: string;
    text?: string;
    attachments?: unknown[];
    is_echo?: boolean;
    is_deleted?: boolean;
    quick_reply?: { payload?: string };
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

async function runBookingBot(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  externalUserId: string;
  conversationId: string;
  text: string | null;
  quickReplyPayload?: string | null;
  postbackPayload?: string | null;
}): Promise<void> {
  try {
    await processInboundMetaBookingBot({
      restaurantId: params.restaurantId,
      conversationId: params.conversationId,
      platform: params.platform,
      externalUserId: params.externalUserId,
      customerName: null,
      text: params.text,
      quickReplyPayload: params.quickReplyPayload,
      postbackPayload: params.postbackPayload,
    });
  } catch (err) {
    console.error("[meta/webhook] booking bot:", err);
  }
}

function notifyInboundMessage(params: {
  restaurantId: string;
  conversationId: string;
  platform: MetaMessagingPlatform;
  contactName: string | null;
  text: string | null;
  hasAttachments?: boolean;
}): void {
  void notifyTeamMetaMessageReceived(params).catch((err) => {
    console.warn("[meta/webhook] push message:", err);
  });
}

async function handlePostbackEvent(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  event: MessagingEvent;
}): Promise<void> {
  const payload = params.event.postback?.payload;
  const senderId = params.event.sender?.id;
  if (!payload || !senderId) return;

  const conv = await getMetaConversationByPeer({
    restaurantId: params.restaurantId,
    platform: params.platform,
    externalUserId: senderId,
  });
  if (!conv) return;

  await runBookingBot({
    restaurantId: params.restaurantId,
    platform: params.platform,
    externalUserId: senderId,
    conversationId: conv.id,
    text: params.event.postback?.title ?? null,
    postbackPayload: payload,
  });
}

async function handleMessagingEvent(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  event: MessagingEvent;
}): Promise<void> {
  if (params.event.postback?.payload && !params.event.message) {
    await handlePostbackEvent(params);
    return;
  }

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
    return;
  }

  const result = await upsertInboundMetaMessage({ ...payload, incrementUnread: true });
  const hasAttachments = Boolean(message.attachments?.length);

  if (result.inserted) {
    notifyInboundMessage({
      restaurantId: params.restaurantId,
      conversationId: result.conversationId,
      platform: params.platform,
      contactName: null,
      text: message.text ?? null,
      hasAttachments,
    });
    await runBookingBot({
      restaurantId: params.restaurantId,
      platform: params.platform,
      externalUserId,
      conversationId: result.conversationId,
      text: message.text ?? null,
      quickReplyPayload: message.quick_reply?.payload ?? null,
    });
  } else if (message.quick_reply?.payload) {
    notifyInboundMessage({
      restaurantId: params.restaurantId,
      conversationId: result.conversationId,
      platform: params.platform,
      contactName: null,
      text: message.text ?? null,
      hasAttachments,
    });
    await runBookingBot({
      restaurantId: params.restaurantId,
      platform: params.platform,
      externalUserId,
      conversationId: result.conversationId,
      text: message.text ?? null,
      quickReplyPayload: message.quick_reply.payload,
    });
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
