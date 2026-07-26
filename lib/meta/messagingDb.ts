import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import {
  getMetaWebhookUrl,
  isMetaMessagingScopesEnabled,
  isMetaWebhookConfigured,
} from "./config";
import type {
  MetaConversation,
  MetaMessage,
  MetaMessageDirection,
  MetaMessagingInbox,
  MetaMessagingPlatform,
} from "./messagingTypes";

type ConversationRow = {
  id: string;
  restaurant_id: string;
  platform: MetaMessagingPlatform;
  external_user_id: string;
  customer_name: string | null;
  customer_profile_pic_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  direction: MetaMessageDirection;
  meta_message_id: string | null;
  text: string | null;
  attachments: unknown;
  created_at: string;
};

function mapConversation(row: ConversationRow): MetaConversation {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    platform: row.platform,
    externalUserId: row.external_user_id,
    customerName: row.customer_name,
    customerProfilePicUrl: row.customer_profile_pic_url,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    unreadCount: row.unread_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): MetaMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    metaMessageId: row.meta_message_id,
    text: row.text,
    attachments: row.attachments,
    createdAt: row.created_at,
  };
}

export async function findRestaurantIdByFacebookPageId(
  facebookPageId: string
): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_meta_connections")
    .select("restaurant_id")
    .eq("facebook_page_id", facebookPageId)
    .maybeSingle();

  if (error || !data) return null;
  return data.restaurant_id as string;
}

export async function findRestaurantIdByInstagramAccountId(
  instagramBusinessAccountId: string
): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_meta_connections")
    .select("restaurant_id")
    .eq("instagram_business_account_id", instagramBusinessAccountId)
    .maybeSingle();

  if (error || !data) return null;
  return data.restaurant_id as string;
}

export async function markMessagingWebhookSubscribed(restaurantId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurant_meta_connections")
    .update({ messaging_webhook_subscribed_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);
}

async function getWebhookSubscribedAt(restaurantId: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_meta_connections")
    .select("messaging_webhook_subscribed_at")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;
  return (data.messaging_webhook_subscribed_at as string | null) ?? null;
}

export async function listMetaConversations(restaurantId: string): Promise<MetaConversation[]> {
  const { data, error } = await supabaseServer
    .from("restaurant_meta_conversations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    if (error.message.includes("restaurant_meta_conversations")) return [];
    throw new Error(error.message);
  }

  return (data as ConversationRow[]).map(mapConversation);
}

export async function listMetaConversationMessages(
  restaurantId: string,
  conversationId: string,
  limit = 80
): Promise<MetaMessage[]> {
  const { data: conv, error: convError } = await supabaseServer
    .from("restaurant_meta_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (convError || !conv) return [];

  const { data, error } = await supabaseServer
    .from("restaurant_meta_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data as MessageRow[]).map(mapMessage);
}

export async function markConversationRead(
  restaurantId: string,
  conversationId: string
): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurant_meta_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId)
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);
}

export async function getMetaMessagingInbox(restaurantId: string): Promise<MetaMessagingInbox> {
  const [conversations, webhookSubscribedAt] = await Promise.all([
    listMetaConversations(restaurantId),
    getWebhookSubscribedAt(restaurantId),
  ]);

  return {
    conversations,
    webhookUrl: getMetaWebhookUrl(),
    messagingScopesEnabled: isMetaMessagingScopesEnabled(),
    webhookConfigured: isMetaWebhookConfigured(),
    webhookSubscribedAt,
  };
}

function previewFromMessage(text: string | null, attachments: unknown): string {
  if (text?.trim()) return text.trim().slice(0, 280);
  if (Array.isArray(attachments) && attachments.length > 0) {
    const first = attachments[0] as { type?: string };
    if (first?.type) return `[${first.type}]`;
    return "[Pièce jointe]";
  }
  return "Message";
}

export async function upsertInboundMetaMessage(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  externalUserId: string;
  metaMessageId: string | null;
  text: string | null;
  attachments: unknown;
  rawPayload: unknown;
  customerName?: string | null;
  incrementUnread?: boolean;
  messageCreatedAt?: string | null;
}): Promise<void> {
  if (params.metaMessageId) {
    const { data: existing } = await supabaseServer
      .from("restaurant_meta_messages")
      .select("id")
      .eq("meta_message_id", params.metaMessageId)
      .maybeSingle();
    if (existing) return;
  }

  const { data: existingConv, error: convLookupError } = await supabaseServer
    .from("restaurant_meta_conversations")
    .select("*")
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", params.platform)
    .eq("external_user_id", params.externalUserId)
    .maybeSingle();

  if (convLookupError) throw new Error(convLookupError.message);

  let conversationId: string;
  const preview = previewFromMessage(params.text, params.attachments);
  const messageAt = params.messageCreatedAt ?? new Date().toISOString();
  const now = messageAt;

  if (existingConv) {
    conversationId = existingConv.id as string;
    const unread = (existingConv.unread_count as number) + (params.incrementUnread ? 1 : 0);
    const { error: updateError } = await supabaseServer
      .from("restaurant_meta_conversations")
      .update({
        last_message_at: now,
        last_message_preview: preview,
        unread_count: unread,
        customer_name: params.customerName ?? existingConv.customer_name,
      })
      .eq("id", conversationId);

    if (updateError) throw new Error(updateError.message);
  } else {
    const { data: created, error: createError } = await supabaseServer
      .from("restaurant_meta_conversations")
      .insert({
        restaurant_id: params.restaurantId,
        platform: params.platform,
        external_user_id: params.externalUserId,
        customer_name: params.customerName ?? null,
        last_message_at: now,
        last_message_preview: preview,
        unread_count: params.incrementUnread ? 1 : 0,
      })
      .select("id")
      .single();

    if (createError || !created) throw new Error(createError?.message ?? "Conversation impossible.");
    conversationId = created.id as string;
  }

  const { error: msgError } = await supabaseServer.from("restaurant_meta_messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    meta_message_id: params.metaMessageId,
    text: params.text,
    attachments: params.attachments ?? null,
    raw_payload: params.rawPayload ?? null,
    created_at: messageAt,
  });

  if (msgError) throw new Error(msgError.message);
}

export async function recordOutboundMetaMessage(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  externalUserId: string;
  metaMessageId: string | null;
  text: string | null;
  attachments?: unknown;
  rawPayload?: unknown;
  customerName?: string | null;
  messageCreatedAt?: string | null;
}): Promise<void> {
  const preview = previewFromMessage(params.text, params.attachments ?? null);
  const messageAt = params.messageCreatedAt ?? new Date().toISOString();
  const now = messageAt;

  const { data: existingConv, error: convLookupError } = await supabaseServer
    .from("restaurant_meta_conversations")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", params.platform)
    .eq("external_user_id", params.externalUserId)
    .maybeSingle();

  if (convLookupError) throw new Error(convLookupError.message);

  let conversationId = existingConv?.id as string | undefined;

  if (!conversationId) {
    const { data: created, error: createError } = await supabaseServer
      .from("restaurant_meta_conversations")
      .insert({
        restaurant_id: params.restaurantId,
        platform: params.platform,
        external_user_id: params.externalUserId,
        customer_name: params.customerName ?? null,
        last_message_at: now,
        last_message_preview: preview,
        unread_count: 0,
      })
      .select("id")
      .single();
    if (createError || !created) throw new Error(createError?.message ?? "Conversation impossible.");
    conversationId = created.id as string;
  } else {
    await supabaseServer
      .from("restaurant_meta_conversations")
      .update({ last_message_at: now, last_message_preview: preview })
      .eq("id", conversationId);
  }

  if (params.metaMessageId) {
    const { data: existing } = await supabaseServer
      .from("restaurant_meta_messages")
      .select("id")
      .eq("meta_message_id", params.metaMessageId)
      .maybeSingle();
    if (existing) return;
  }

  const { error: msgError } = await supabaseServer.from("restaurant_meta_messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    meta_message_id: params.metaMessageId,
    text: params.text,
    attachments: params.attachments ?? null,
    raw_payload: params.rawPayload ?? null,
    created_at: messageAt,
  });

  if (msgError) throw new Error(msgError.message);
}
