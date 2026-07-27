import "server-only";

import { processInboundMetaBookingBot } from "./bookingBot";
import { parseConversationBookingState } from "./bookingBotTypes";
import {
  getLatestInboundMetaMessage,
  listRecentMetaConversations,
} from "./messagingDb";

const CATCHUP_MAX_AGE_MS = 30 * 60_000;

function inboundMessageKey(metaMessageId: string | null, fallbackId: string): string {
  return metaMessageId ?? fallbackId;
}

/**
 * Traite au plus un message entrant récent par conversation (fallback si webhook Meta absent).
 * Évite de relancer le bot sur tout l'historique lors d'un refresh Ubion.
 */
export async function processBookingBotCatchUp(restaurantId: string): Promise<void> {
  const conversations = await listRecentMetaConversations(restaurantId, CATCHUP_MAX_AGE_MS);

  for (const conv of conversations) {
    const latest = await getLatestInboundMetaMessage(conv.id);
    if (!latest) continue;

    const ageMs = Date.now() - new Date(latest.createdAt).getTime();
    if (Number.isNaN(ageMs) || ageMs > CATCHUP_MAX_AGE_MS) continue;

    const state = parseConversationBookingState(conv.bookingState);
    const messageKey = inboundMessageKey(latest.metaMessageId, latest.id);
    if (state.lastProcessedInboundId === messageKey) continue;

    try {
      await processInboundMetaBookingBot({
        restaurantId,
        conversationId: conv.id,
        platform: conv.platform,
        externalUserId: conv.externalUserId,
        customerName: conv.customerName,
        text: latest.text,
        inboundMessageId: messageKey,
      });
    } catch (err) {
      console.warn("[meta/bookingBotCatchUp]", conv.id, err);
    }
  }
}
