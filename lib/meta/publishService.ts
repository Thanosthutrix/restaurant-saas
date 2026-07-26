import "server-only";

import {
  fetchInstagramMediaFeed,
  publishFacebookPagePost,
  publishInstagramImage,
  type SocialFeedItem,
} from "@/lib/meta/graphApi";
import { syncInstagramStories } from "@/lib/meta/metaDb";
import type { SocialContentType, SocialPlatform } from "@/lib/meta/socialPostsDb";
import { insertSocialPost, updateSocialPost } from "@/lib/meta/socialPostsDb";
import { uploadSocialMediaImage } from "@/lib/meta/socialMediaStorage";
import { supabaseServer } from "@/lib/supabaseServer";

type ConnectionTokens = {
  facebookPageId: string | null;
  instagramBusinessAccountId: string | null;
  pageAccessToken: string | null;
};

async function getConnectionTokens(restaurantId: string): Promise<ConnectionTokens | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_meta_connections")
    .select("facebook_page_id, instagram_business_account_id, page_access_token, connection_status")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.connection_status !== "connected" || !data.page_access_token) return null;

  return {
    facebookPageId: data.facebook_page_id,
    instagramBusinessAccountId: data.instagram_business_account_id,
    pageAccessToken: data.page_access_token,
  };
}

export async function loadCommunicationFeed(restaurantId: string): Promise<{
  feed: SocialFeedItem[];
  feedError: string | null;
}> {
  const conn = await getConnectionTokens(restaurantId);
  if (!conn?.instagramBusinessAccountId || !conn.pageAccessToken) {
    return { feed: [], feedError: null };
  }

  try {
    const feed = await fetchInstagramMediaFeed(
      conn.instagramBusinessAccountId,
      conn.pageAccessToken
    );
    return { feed, feedError: null };
  } catch (err) {
    return {
      feed: [],
      feedError: err instanceof Error ? err.message : "Lecture du fil Instagram impossible.",
    };
  }
}

export async function refreshCommunicationStories(restaurantId: string) {
  return syncInstagramStories(restaurantId, true);
}

export async function publishCommunicationPost(params: {
  restaurantId: string;
  userId: string;
  platform: SocialPlatform;
  contentType: SocialContentType;
  caption: string;
  imageBytes: Uint8Array;
  contentTypeHeader: string;
}): Promise<{ postId: string; permalink: string | null }> {
  const conn = await getConnectionTokens(params.restaurantId);
  if (!conn?.pageAccessToken) {
    throw new Error("Connectez d'abord Facebook / Instagram dans l'onglet Comptes.");
  }

  const { publicUrl } = await uploadSocialMediaImage({
    restaurantId: params.restaurantId,
    bytes: params.imageBytes,
    contentType: params.contentTypeHeader,
  });

  const draft = await insertSocialPost({
    restaurantId: params.restaurantId,
    platform: params.platform,
    contentType: params.contentType,
    caption: params.caption.trim() || null,
    mediaUrl: publicUrl,
    status: "publishing",
    createdBy: params.userId,
  });

  try {
    if (params.platform === "instagram") {
      if (!conn.instagramBusinessAccountId) {
        throw new Error("Aucun compte Instagram Business lié.");
      }
      const result = await publishInstagramImage({
        instagramBusinessAccountId: conn.instagramBusinessAccountId,
        pageAccessToken: conn.pageAccessToken,
        imageUrl: publicUrl,
        caption: params.caption,
        contentType: params.contentType,
      });
      await updateSocialPost(draft.id, {
        status: "published",
        metaMediaId: result.mediaId,
        metaPermalink: result.permalink,
        errorMessage: null,
        publishedAt: new Date().toISOString(),
      });
      if (params.contentType === "story") {
        await syncInstagramStories(params.restaurantId, true);
      }
      return { postId: draft.id, permalink: result.permalink };
    }

    if (!conn.facebookPageId) {
      throw new Error("Aucune page Facebook liée.");
    }
    const result = await publishFacebookPagePost({
      facebookPageId: conn.facebookPageId,
      pageAccessToken: conn.pageAccessToken,
      message: params.caption,
      imageUrl: publicUrl,
    });
    await updateSocialPost(draft.id, {
      status: "published",
      metaMediaId: result.postId,
      metaPermalink: result.permalink,
      errorMessage: null,
      publishedAt: new Date().toISOString(),
    });
    return { postId: draft.id, permalink: result.permalink };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publication impossible.";
    await updateSocialPost(draft.id, {
      status: "failed",
      metaMediaId: null,
      metaPermalink: null,
      errorMessage: message,
      publishedAt: null,
    });
    throw new Error(message);
  }
}
