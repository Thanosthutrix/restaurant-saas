import "server-only";

import { supabaseServer } from "@/lib/supabaseServer";

export type SocialPlatform = "instagram" | "facebook";
export type SocialContentType = "feed" | "story" | "reel";
export type SocialPostStatus = "draft" | "publishing" | "published" | "failed";

export type SocialPostRow = {
  id: string;
  restaurant_id: string;
  platform: SocialPlatform;
  content_type: SocialContentType;
  caption: string | null;
  media_url: string | null;
  status: SocialPostStatus;
  meta_media_id: string | null;
  meta_permalink: string | null;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type SocialPost = {
  id: string;
  restaurantId: string;
  platform: SocialPlatform;
  contentType: SocialContentType;
  caption: string | null;
  mediaUrl: string | null;
  status: SocialPostStatus;
  metaMediaId: string | null;
  metaPermalink: string | null;
  errorMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
};

function mapRow(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    platform: row.platform,
    contentType: row.content_type,
    caption: row.caption,
    mediaUrl: row.media_url,
    status: row.status,
    metaMediaId: row.meta_media_id,
    metaPermalink: row.meta_permalink,
    errorMessage: row.error_message,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export async function listSocialPosts(restaurantId: string, limit = 40): Promise<SocialPost[]> {
  const { data, error } = await supabaseServer
    .from("social_posts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.includes("social_posts")) return [];
    throw new Error(error.message);
  }

  return (data as SocialPostRow[]).map(mapRow);
}

export async function insertSocialPost(params: {
  restaurantId: string;
  platform: SocialPlatform;
  contentType: SocialContentType;
  caption: string | null;
  mediaUrl: string | null;
  status: SocialPostStatus;
  createdBy: string | null;
}): Promise<SocialPost> {
  const { data, error } = await supabaseServer
    .from("social_posts")
    .insert({
      restaurant_id: params.restaurantId,
      platform: params.platform,
      content_type: params.contentType,
      caption: params.caption,
      media_url: params.mediaUrl,
      status: params.status,
      created_by: params.createdBy,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as SocialPostRow);
}

export async function updateSocialPost(
  id: string,
  patch: Partial<{
    status: SocialPostStatus;
    metaMediaId: string | null;
    metaPermalink: string | null;
    errorMessage: string | null;
    publishedAt: string | null;
  }>
): Promise<void> {
  const { error } = await supabaseServer
    .from("social_posts")
    .update({
      status: patch.status,
      meta_media_id: patch.metaMediaId,
      meta_permalink: patch.metaPermalink,
      error_message: patch.errorMessage,
      published_at: patch.publishedAt,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
