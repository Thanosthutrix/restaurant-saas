import type { SocialStory } from "@/lib/public/types";
import { metaGraphUrl } from "./config";

export type MetaFacebookPage = {
  id: string;
  name: string;
  accessToken: string;
  link: string | null;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
};

type GraphPageRow = {
  id: string;
  name: string;
  access_token: string;
  link?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  } | null;
};

type GraphStoriesResponse = {
  data?: Array<{
    id: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp?: string;
  }>;
  error?: { message: string; code?: number };
};

export async function listMetaFacebookPages(userAccessToken: string): Promise<MetaFacebookPage[]> {
  const params = new URLSearchParams({
    fields: "id,name,access_token,link,instagram_business_account{id,username}",
    access_token: userAccessToken,
    limit: "50",
  });

  const res = await fetch(`${metaGraphUrl("me/accounts")}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pages Facebook introuvables (${res.status}) : ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { data?: GraphPageRow[]; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);

  return (json.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    accessToken: row.access_token,
    link: row.link ?? null,
    instagramBusinessAccountId: row.instagram_business_account?.id ?? null,
    instagramUsername: row.instagram_business_account?.username ?? null,
  }));
}

export async function fetchInstagramStories(
  instagramBusinessAccountId: string,
  pageAccessToken: string
): Promise<SocialStory[]> {
  const params = new URLSearchParams({
    fields: "id,media_type,media_url,thumbnail_url,permalink,timestamp",
    access_token: pageAccessToken,
  });

  const res = await fetch(
    `${metaGraphUrl(`${instagramBusinessAccountId}/stories`)}?${params.toString()}`
  );

  const json = (await res.json()) as GraphStoriesResponse;
  if (json.error) {
    if (json.error.code === 100 || json.error.message.includes("nonexisting")) {
      return [];
    }
    throw new Error(json.error.message);
  }

  return (json.data ?? [])
    .filter((s) => s.media_url || s.thumbnail_url)
    .map((s) => ({
      id: s.id,
      mediaType: (s.media_type === "VIDEO" ? "VIDEO" : "IMAGE") as SocialStory["mediaType"],
      mediaUrl: s.media_url ?? s.thumbnail_url ?? "",
      thumbnailUrl: s.thumbnail_url ?? s.media_url ?? "",
      permalink: s.permalink ?? null,
      timestamp: s.timestamp ?? new Date().toISOString(),
    }));
}
