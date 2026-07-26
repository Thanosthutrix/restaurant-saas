import "server-only";

import { sendMetaTextMessage } from "./messagingApi";
import { recordOutboundMetaMessage } from "./messagingDb";
import type { MetaMessagingPlatform } from "./messagingTypes";

export async function sendMetaConversationReply(params: {
  restaurantId: string;
  platform: MetaMessagingPlatform;
  externalUserId: string;
  facebookPageId: string;
  pageAccessToken: string;
  text: string;
  customerName?: string | null;
}): Promise<void> {
  const trimmed = params.text.trim();
  if (!trimmed) throw new Error("Message vide.");

  const sent = await sendMetaTextMessage({
    facebookPageId: params.facebookPageId,
    pageAccessToken: params.pageAccessToken,
    recipientId: params.externalUserId,
    text: trimmed,
  });

  await recordOutboundMetaMessage({
    restaurantId: params.restaurantId,
    platform: params.platform,
    externalUserId: params.externalUserId,
    metaMessageId: sent.messageId,
    text: trimmed,
    customerName: params.customerName ?? null,
    rawPayload: { source: "ubion_outbound" },
  });
}

export async function getMetaPageMessagingCredentials(restaurantId: string): Promise<{
  facebookPageId: string;
  pageAccessToken: string;
} | null> {
  const { supabaseServer } = await import("@/lib/supabaseServer");
  const { data, error } = await supabaseServer
    .from("restaurant_meta_connections")
    .select("facebook_page_id, page_access_token")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data?.facebook_page_id || !data.page_access_token) return null;
  return {
    facebookPageId: data.facebook_page_id as string,
    pageAccessToken: data.page_access_token as string,
  };
}
