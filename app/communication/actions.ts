"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import {
  loadCommunicationFeed,
  publishCommunicationBatch,
  refreshCommunicationStories,
  type PublishPlatformResult,
} from "@/lib/meta/publishService";
import { getRestaurantSocialState } from "@/lib/meta/metaDb";
import { ensureMetaMessagingWebhooksSubscribed } from "@/lib/meta/metaDb";
import { syncMetaMessagingFromGraph } from "@/lib/meta/messagingSync";
import {
  getMetaConversationContext,
  getMetaMessagingInbox,
  listMetaConversationMessages,
  markConversationRead,
} from "@/lib/meta/messagingDb";
import {
  getMetaPageMessagingCredentials,
  sendMetaConversationReply,
} from "@/lib/meta/messagingSend";
import type { MetaMessage, MetaMessagingInbox } from "@/lib/meta/messagingTypes";
import { parsePublishRequestFromFormData } from "@/lib/meta/publishOptions";
import { listSocialPosts } from "@/lib/meta/socialPostsDb";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function assertRestaurantAccess(userId: string, restaurantId: string) {
  const list = await getAccessibleRestaurantsForUser(userId);
  if (!list.some((r) => r.id === restaurantId)) {
    return { ok: false as const, error: "Accès refusé à ce restaurant." };
  }
  return { ok: true as const };
}

function revalidateCommunicationPaths() {
  revalidatePath("/communication");
}

export async function refreshCommunicationContentAction(
  restaurantId: string
): Promise<
  ActionResult<{
    socialState: Awaited<ReturnType<typeof getRestaurantSocialState>>;
    feed: Awaited<ReturnType<typeof loadCommunicationFeed>>;
    publishedPosts: Awaited<ReturnType<typeof listSocialPosts>>;
  }>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    await refreshCommunicationStories(restaurantId);
    const [socialState, feed, publishedPosts] = await Promise.all([
      getRestaurantSocialState(restaurantId),
      loadCommunicationFeed(restaurantId),
      listSocialPosts(restaurantId),
    ]);
    revalidateCommunicationPaths();
    return { ok: true, data: { socialState, feed, publishedPosts } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Actualisation impossible." };
  }
}

export async function publishCommunicationPostAction(
  formData: FormData
): Promise<
  ActionResult<{
    batchId: string;
    results: PublishPlatformResult[];
  }>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const restaurantId = String(formData.get("restaurantId") ?? "");
  if (!restaurantId) return { ok: false, error: "Restaurant manquant." };

  const parsed = parsePublishRequestFromFormData(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Image requise." };
  }

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const batch = await publishCommunicationBatch({
      restaurantId,
      userId: user.id,
      request: parsed,
      imageBytes: bytes,
      contentTypeHeader: file.type || "image/jpeg",
    });
    revalidateCommunicationPaths();
    revalidatePath(`/restaurant/${restaurantId}`);

    const allFailed = batch.results.every((r) => !r.ok);
    if (allFailed) {
      return {
        ok: false,
        error: batch.results.map((r) => `${r.platform}: ${r.error}`).join(" · "),
      };
    }

    return { ok: true, data: batch };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Publication impossible." };
  }
}

export async function loadMetaMessagingInboxAction(
  restaurantId: string
): Promise<ActionResult<MetaMessagingInbox>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    await syncMetaMessagingFromGraph(restaurantId);
    return { ok: true, data: await getMetaMessagingInbox(restaurantId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chargement impossible." };
  }
}

export async function loadMetaConversationMessagesAction(
  restaurantId: string,
  conversationId: string
): Promise<ActionResult<{ inbox: MetaMessagingInbox; messages: MetaMessage[] }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    await syncMetaMessagingFromGraph(restaurantId);
    const [inbox, messages] = await Promise.all([
      getMetaMessagingInbox(restaurantId),
      listMetaConversationMessages(restaurantId, conversationId),
    ]);
    return { ok: true, data: { inbox, messages } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chargement impossible." };
  }
}

export async function subscribeMetaMessagingWebhooksAction(
  restaurantId: string
): Promise<ActionResult<MetaMessagingInbox>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    const result = await ensureMetaMessagingWebhooksSubscribed(restaurantId);
    if (!result.ok) return { ok: false, error: result.error };
    revalidateCommunicationPaths();
    await syncMetaMessagingFromGraph(restaurantId);
    return { ok: true, data: await getMetaMessagingInbox(restaurantId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Activation impossible." };
  }
}

export async function sendMetaConversationMessageAction(
  restaurantId: string,
  conversationId: string,
  text: string
): Promise<ActionResult<{ inbox: MetaMessagingInbox; messages: MetaMessage[] }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Message vide." };

  try {
    const conv = await getMetaConversationContext(restaurantId, conversationId);
    if (!conv) return { ok: false, error: "Conversation introuvable." };

    const creds = await getMetaPageMessagingCredentials(restaurantId);
    if (!creds) {
      return { ok: false, error: "Compte Meta non connecté ou page non liée." };
    }

    await sendMetaConversationReply({
      restaurantId,
      platform: conv.platform,
      externalUserId: conv.externalUserId,
      facebookPageId: creds.facebookPageId,
      pageAccessToken: creds.pageAccessToken,
      text: trimmed,
      customerName: conv.customerName,
    });

    revalidateCommunicationPaths();
    const [inbox, messages] = await Promise.all([
      getMetaMessagingInbox(restaurantId),
      listMetaConversationMessages(restaurantId, conversationId),
    ]);
    return { ok: true, data: { inbox, messages } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Envoi impossible." };
  }
}

export async function markMetaConversationReadAction(
  restaurantId: string,
  conversationId: string
): Promise<ActionResult<void>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    await markConversationRead(restaurantId, conversationId);
    revalidateCommunicationPaths();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Mise à jour impossible." };
  }
}
