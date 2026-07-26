import "server-only";

import { randomUUID } from "crypto";
import {
  fetchInstagramMediaFeed,
  publishFacebookPagePost,
  publishFacebookPageStory,
  publishInstagramImage,
  type SocialFeedItem,
} from "@/lib/meta/graphApi";
import { syncInstagramStories } from "@/lib/meta/metaDb";
import type { PublishRequest, PublishTarget } from "@/lib/meta/publishOptions";
import { buildFacebookTargeting, resolvePublishTargets } from "@/lib/meta/publishOptions";
import type { SocialContentType, SocialPlatform } from "@/lib/meta/socialPostsDb";
import { insertSocialPost, updateSocialPost } from "@/lib/meta/socialPostsDb";
import { uploadSocialMediaImage } from "@/lib/meta/socialMediaStorage";
import { supabaseServer } from "@/lib/supabaseServer";

type ConnectionTokens = {
  facebookPageId: string | null;
  instagramBusinessAccountId: string | null;
  pageAccessToken: string | null;
};

export type PublishPlatformResult = {
  platform: SocialPlatform;
  contentType: SocialContentType;
  ok: boolean;
  postId?: string;
  permalink?: string | null;
  error?: string;
  note?: string;
};

export type PublishBatchResult = {
  batchId: string;
  results: PublishPlatformResult[];
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

async function publishToTarget(params: {
  target: PublishTarget;
  request: PublishRequest;
  conn: ConnectionTokens;
  publicUrl: string;
  restaurantId: string;
  userId: string;
  batchId: string;
}): Promise<PublishPlatformResult> {
  const { target, request, conn, publicUrl, restaurantId, userId, batchId } = params;
  const base = {
    platform: target.platform,
    contentType: target.contentType,
    note: target.note,
  };

  const draft = await insertSocialPost({
    restaurantId,
    platform: target.platform,
    contentType: target.contentType,
    caption: request.caption.trim() || null,
    mediaUrl: publicUrl,
    status: "publishing",
    createdBy: userId,
    publishBatchId: batchId,
    publishOptions: request,
  });

  try {
    if (target.platform === "instagram") {
      if (!conn.instagramBusinessAccountId) {
        throw new Error("Aucun compte Instagram Business lié.");
      }
      const result = await publishInstagramImage({
        instagramBusinessAccountId: conn.instagramBusinessAccountId,
        pageAccessToken: conn.pageAccessToken!,
        imageUrl: publicUrl,
        caption: request.caption,
        contentType: target.contentType,
        locationId: request.instagram.locationId,
        userTagUsername: request.instagram.userTagUsername,
        shareReelToFeed: request.instagram.shareReelToFeed,
      });
      await updateSocialPost(draft.id, {
        status: "published",
        metaMediaId: result.mediaId,
        metaPermalink: result.permalink,
        errorMessage: null,
        publishedAt: new Date().toISOString(),
      });
      if (target.contentType === "story") {
        await syncInstagramStories(restaurantId, true);
      }
      return { ...base, ok: true, postId: draft.id, permalink: result.permalink };
    }

    if (!conn.facebookPageId) {
      throw new Error("Aucune page Facebook liée.");
    }

    const scheduledPublishTime = request.facebook.scheduledAt
      ? Math.floor(new Date(request.facebook.scheduledAt).getTime() / 1000)
      : null;
    const targeting = buildFacebookTargeting(request.facebook);

    if (target.contentType === "story") {
      const result = await publishFacebookPageStory({
        facebookPageId: conn.facebookPageId,
        pageAccessToken: conn.pageAccessToken!,
        imageUrl: publicUrl,
      });
      await updateSocialPost(draft.id, {
        status: "published",
        metaMediaId: result.postId,
        metaPermalink: result.permalink,
        errorMessage: null,
        publishedAt: new Date().toISOString(),
      });
      return { ...base, ok: true, postId: draft.id, permalink: result.permalink };
    }

    const result = await publishFacebookPagePost({
      facebookPageId: conn.facebookPageId,
      pageAccessToken: conn.pageAccessToken!,
      message: request.caption,
      imageUrl: publicUrl,
      scheduledPublishTime,
      targeting,
    });
    await updateSocialPost(draft.id, {
      status: "published",
      metaMediaId: result.postId,
      metaPermalink: result.permalink,
      errorMessage: null,
      publishedAt: scheduledPublishTime ? request.facebook.scheduledAt : new Date().toISOString(),
    });
    return { ...base, ok: true, postId: draft.id, permalink: result.permalink };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publication impossible.";
    await updateSocialPost(draft.id, {
      status: "failed",
      metaMediaId: null,
      metaPermalink: null,
      errorMessage: message,
      publishedAt: null,
    });
    return { ...base, ok: false, error: message };
  }
}

/** Publication simultanée sur un ou plusieurs réseaux (même média). */
export async function publishCommunicationBatch(params: {
  restaurantId: string;
  userId: string;
  request: PublishRequest;
  imageBytes: Uint8Array;
  contentTypeHeader: string;
}): Promise<PublishBatchResult> {
  const conn = await getConnectionTokens(params.restaurantId);
  if (!conn?.pageAccessToken) {
    throw new Error("Connectez d'abord Facebook / Instagram dans l'onglet Comptes.");
  }

  for (const platform of params.request.platforms) {
    if (platform === "instagram" && !conn.instagramBusinessAccountId) {
      throw new Error("Instagram non connecté.");
    }
    if (platform === "facebook" && !conn.facebookPageId) {
      throw new Error("Facebook non connecté.");
    }
  }

  const { publicUrl } = await uploadSocialMediaImage({
    restaurantId: params.restaurantId,
    bytes: params.imageBytes,
    contentType: params.contentTypeHeader,
  });

  const batchId = randomUUID();
  const targets = resolvePublishTargets(params.request);
  const results: PublishPlatformResult[] = [];

  for (const target of targets) {
    results.push(
      await publishToTarget({
        target,
        request: params.request,
        conn,
        publicUrl,
        restaurantId: params.restaurantId,
        userId: params.userId,
        batchId,
      })
    );
  }

  return { batchId, results };
}

/** @deprecated Utiliser publishCommunicationBatch */
export async function publishCommunicationPost(params: {
  restaurantId: string;
  userId: string;
  platform: SocialPlatform;
  contentType: SocialContentType;
  caption: string;
  imageBytes: Uint8Array;
  contentTypeHeader: string;
}): Promise<{ postId: string; permalink: string | null }> {
  const batch = await publishCommunicationBatch({
    restaurantId: params.restaurantId,
    userId: params.userId,
    imageBytes: params.imageBytes,
    contentTypeHeader: params.contentTypeHeader,
    request: {
      platforms: [params.platform],
      contentType: params.contentType,
      caption: params.caption,
      instagram: { locationId: null, userTagUsername: null, shareReelToFeed: true },
      facebook: { scheduledAt: null, countries: [], ageMin: null, ageMax: null },
    },
  });
  const first = batch.results[0];
  if (!first?.ok) {
    throw new Error(first?.error ?? "Publication impossible.");
  }
  return { postId: first.postId!, permalink: first.permalink ?? null };
}
