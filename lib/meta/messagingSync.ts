import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";
import { processInboundMetaBookingBot } from "./bookingBot";
import { metaGraphUrl } from "./config";
import { recordOutboundMetaMessage, upsertInboundMetaMessage } from "./messagingDb";
import type { MetaMessagingPlatform } from "./messagingTypes";

type GraphParticipant = {
  id?: string;
  name?: string;
  username?: string;
};

type GraphMessage = {
  id?: string;
  message?: string;
  created_time?: string;
  from?: GraphParticipant;
};

type GraphConversation = {
  id?: string;
  participants?: { data?: GraphParticipant[] };
  messages?: { data?: GraphMessage[] };
};

type GraphListResponse = {
  data?: GraphConversation[];
  error?: { message?: string };
};

const CONVERSATION_FIELDS =
  "participants,messages.limit(25){message,from,created_time,id}";

function isRecentIso(iso: string | null | undefined, maxAgeMs = 20 * 60_000): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && Date.now() - t < maxAgeMs;
}

async function fetchGraphConversations(
  pathWithQuery: string,
  pageAccessToken: string
): Promise<GraphConversation[]> {
  const url = new URL(metaGraphUrl(pathWithQuery));
  url.searchParams.set("fields", CONVERSATION_FIELDS);
  url.searchParams.set("access_token", pageAccessToken);

  const res = await fetch(url.toString());
  const json = (await res.json()) as GraphListResponse;
  if (!res.ok) {
    const msg = json.error?.message ?? `Graph API ${res.status}`;
    throw new Error(msg);
  }
  return json.data ?? [];
}

function participantLabel(participant: GraphParticipant | undefined): string | null {
  if (!participant) return null;
  return participant.name?.trim() || participant.username?.trim() || null;
}

function resolveExternalParticipant(
  participants: GraphParticipant[],
  businessId: string
): { externalUserId: string; customerName: string | null } | null {
  const customer = participants.find((p) => p.id && p.id !== businessId);
  if (!customer?.id) return null;
  return {
    externalUserId: customer.id,
    customerName: participantLabel(customer),
  };
}

async function syncPlatformConversations(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  businessId: string;
  graphPath: string;
  pageAccessToken: string;
}): Promise<number> {
  let conversations: GraphConversation[];
  try {
    conversations = await fetchGraphConversations(params.graphPath, params.pageAccessToken);
  } catch (err) {
    console.warn("[meta/messagingSync]", params.platform, err);
    return 0;
  }

  let synced = 0;

  for (const conversation of conversations) {
    const participants = conversation.participants?.data ?? [];
    const peer = resolveExternalParticipant(participants, params.businessId);
    if (!peer) continue;

    const messages = [...(conversation.messages?.data ?? [])].reverse();
    for (const message of messages) {
      if (!message.id) continue;
      const text = message.message?.trim() || null;
      if (!text) continue;

      const fromId = message.from?.id;
      const isOutbound = fromId === params.businessId;
      const payload = {
        restaurantId: params.restaurantId,
        platform: params.platform,
        externalUserId: peer.externalUserId,
        metaMessageId: message.id,
        text,
        attachments: null,
        rawPayload: message,
        customerName: peer.customerName,
        messageCreatedAt: message.created_time ?? null,
      };

      if (isOutbound) {
        await recordOutboundMetaMessage(payload);
      } else {
        const result = await upsertInboundMetaMessage({ ...payload, incrementUnread: false });
        if (result.inserted && isRecentIso(message.created_time)) {
          try {
            await processInboundMetaBookingBot({
              restaurantId: params.restaurantId,
              conversationId: result.conversationId,
              platform: params.platform,
              externalUserId: peer.externalUserId,
              customerName: peer.customerName,
              text,
            });
          } catch (err) {
            console.warn("[meta/messagingSync] booking bot:", err);
          }
        }
      }
      synced += 1;
    }
  }

  return synced;
}

/** Récupère les DM Messenger / Instagram via Graph API (fallback si webhook Meta absent). */
export async function syncMetaMessagingFromGraph(
  restaurantId: string
): Promise<{ syncedMessages: number }> {
  const { data, error } = await supabaseServer
    .from("restaurant_meta_connections")
    .select("facebook_page_id, instagram_business_account_id, page_access_token, connection_status")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.page_access_token || !data.facebook_page_id) {
    return { syncedMessages: 0 };
  }

  const pageAccessToken = data.page_access_token as string;
  const pageId = data.facebook_page_id as string;
  const igId = data.instagram_business_account_id as string | null;

  let syncedMessages = 0;

  syncedMessages += await syncPlatformConversations({
    restaurantId,
    platform: "facebook_messenger",
    businessId: pageId,
    graphPath: `${pageId}/conversations?platform=messenger`,
    pageAccessToken,
  });

  if (igId) {
    syncedMessages += await syncPlatformConversations({
      restaurantId,
      platform: "instagram_dm",
      businessId: igId,
      graphPath: `${pageId}/conversations?platform=instagram`,
      pageAccessToken,
    });
  }

  return { syncedMessages };
}
