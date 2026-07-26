"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import {
  loadCommunicationFeed,
  publishCommunicationPost,
  refreshCommunicationStories,
} from "@/lib/meta/publishService";
import { getRestaurantSocialState } from "@/lib/meta/metaDb";
import { listSocialPosts } from "@/lib/meta/socialPostsDb";
import type { SocialContentType, SocialPlatform } from "@/lib/meta/socialPostsDb";

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
): Promise<ActionResult<{ permalink: string | null }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const restaurantId = String(formData.get("restaurantId") ?? "");
  const platform = String(formData.get("platform") ?? "") as SocialPlatform;
  const contentType = String(formData.get("contentType") ?? "") as SocialContentType;
  const caption = String(formData.get("caption") ?? "");
  const file = formData.get("image");

  if (!restaurantId) return { ok: false, error: "Restaurant manquant." };
  if (platform !== "instagram" && platform !== "facebook") {
    return { ok: false, error: "Réseau invalide." };
  }
  if (contentType !== "feed" && contentType !== "story" && contentType !== "reel") {
    return { ok: false, error: "Type de contenu invalide." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Image requise." };
  }

  const access = await assertRestaurantAccess(user.id, restaurantId);
  if (!access.ok) return access;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await publishCommunicationPost({
      restaurantId,
      userId: user.id,
      platform,
      contentType,
      caption,
      imageBytes: bytes,
      contentTypeHeader: file.type || "image/jpeg",
    });
    revalidateCommunicationPaths();
    revalidatePath(`/restaurant/${restaurantId}`);
    return { ok: true, data: { permalink: result.permalink } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Publication impossible." };
  }
}
