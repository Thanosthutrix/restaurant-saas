import type { SocialStory } from "@/lib/public/types";
import { metaGraphUrl } from "./config";

export type SocialFeedItem = {
  id: string;
  platform: "instagram";
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL";
  caption: string | null;
  mediaUrl: string;
  thumbnailUrl: string;
  permalink: string | null;
  timestamp: string;
};

export type PublishInstagramResult = {
  mediaId: string;
  permalink: string | null;
};

export type PublishFacebookResult = {
  postId: string;
  permalink: string | null;
};

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
  access_token?: string;
  link?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  } | null;
};

const META_PAGE_FIELDS =
  "id,name,access_token,link,instagram_business_account{id,username}";

const META_NO_PAGES_ERROR =
  "Meta ne renvoie aucune page Facebook pour ce compte. Utilisez un compte admin d'une page pro (pas un profil perso seul). Lors de la connexion, cochez bien la page à partager avec Ubion, ou créez une page sur facebook.com/pages/create puis reconnectez-vous.";

export type DiscoverMetaFacebookPagesOptions = {
  facebookUrlHint?: string | null;
};

export type FacebookPageReference =
  | { type: "id"; value: string }
  | { type: "slug"; value: string };

const FACEBOOK_PATH_BLOCKLIST = new Set([
  "share",
  "sharer",
  "groups",
  "events",
  "watch",
  "gaming",
  "login",
  "help",
  "pages",
]);

export function extractFacebookPageReference(raw: string): FacebookPageReference | null {
  const input = raw.trim();
  if (!input) return null;

  try {
    const u = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (!u.hostname.includes("facebook.com") && !u.hostname.includes("fb.com")) {
      return null;
    }

    const idParam = u.searchParams.get("id");
    if (idParam && /^\d+$/.test(idParam)) {
      return { type: "id", value: idParam };
    }

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "profile.php" && idParam && /^\d+$/.test(idParam)) {
      return { type: "id", value: idParam };
    }

    if (parts[0] === "pages" && parts.length >= 2) {
      const last = parts[parts.length - 1]!;
      if (/^\d+$/.test(last)) return { type: "id", value: last };
      if (!FACEBOOK_PATH_BLOCKLIST.has(last)) return { type: "slug", value: last };
    }

    const first = parts[0];
    if (first && !FACEBOOK_PATH_BLOCKLIST.has(first)) {
      if (/^\d+$/.test(first)) return { type: "id", value: first };
      return { type: "slug", value: first };
    }

    return null;
  } catch {
    return null;
  }
}

function mapGraphPageRow(row: GraphPageRow): MetaFacebookPage | null {
  if (!row.id || !row.name || !row.access_token) return null;
  return {
    id: row.id,
    name: row.name,
    accessToken: row.access_token,
    link: row.link ?? null,
    instagramBusinessAccountId: row.instagram_business_account?.id ?? null,
    instagramUsername: row.instagram_business_account?.username ?? null,
  };
}

async function fetchGraphPageRows(
  path: string,
  userAccessToken: string,
  maxRows = 100
): Promise<GraphPageRow[]> {
  const params = new URLSearchParams({
    fields: META_PAGE_FIELDS,
    access_token: userAccessToken,
    limit: "50",
  });

  const rows: GraphPageRow[] = [];
  let nextUrl: string | null = `${metaGraphUrl(path)}?${params.toString()}`;

  while (nextUrl && rows.length < maxRows) {
    const res = await fetch(nextUrl);
    if (!res.ok) break;

    const json = (await res.json()) as {
      data?: GraphPageRow[];
      error?: { message: string };
      paging?: { next?: string };
    };
    if (json.error) break;

    rows.push(...(json.data ?? []));
    nextUrl = json.paging?.next ?? null;
  }

  return rows;
}

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

async function listMetaFacebookPagesFromAccounts(
  userAccessToken: string
): Promise<MetaFacebookPage[]> {
  const rows = await fetchGraphPageRows("me/accounts", userAccessToken);
  return rows.map(mapGraphPageRow).filter((p): p is MetaFacebookPage => p != null);
}

async function listMetaFacebookPagesViaBusinesses(
  userAccessToken: string
): Promise<MetaFacebookPage[]> {
  const bizParams = new URLSearchParams({
    fields: "id,name",
    access_token: userAccessToken,
    limit: "25",
  });
  const bizRes = await fetch(`${metaGraphUrl("me/businesses")}?${bizParams.toString()}`);
  if (!bizRes.ok) return [];

  const bizJson = (await bizRes.json()) as {
    data?: Array<{ id: string; name?: string }>;
    error?: { message: string };
  };
  if (bizJson.error) return [];

  const byId = new Map<string, MetaFacebookPage>();

  for (const biz of bizJson.data ?? []) {
    for (const edge of ["owned_pages", "client_pages"] as const) {
      const rows = await fetchGraphPageRows(`${biz.id}/${edge}`, userAccessToken, 50);
      for (const row of rows) {
        if (byId.has(row.id)) continue;
        let page = mapGraphPageRow(row);
        if (!page) {
          page = await fetchMetaFacebookPageById(row.id, userAccessToken);
        }
        if (page) byId.set(page.id, page);
      }
    }
  }

  return [...byId.values()];
}

export async function fetchMetaFacebookPageById(
  pageIdOrSlug: string,
  userAccessToken: string
): Promise<MetaFacebookPage | null> {
  const params = new URLSearchParams({
    fields: META_PAGE_FIELDS,
    access_token: userAccessToken,
  });
  const res = await fetch(`${metaGraphUrl(pageIdOrSlug)}?${params.toString()}`);
  if (!res.ok) return null;

  const json = (await res.json()) as GraphPageRow & { error?: { message: string } };
  if (json.error) return null;
  return mapGraphPageRow(json);
}

export async function discoverMetaFacebookPages(
  userAccessToken: string,
  opts?: DiscoverMetaFacebookPagesOptions
): Promise<MetaFacebookPage[]> {
  const byId = new Map<string, MetaFacebookPage>();

  const add = (pages: MetaFacebookPage[]) => {
    for (const page of pages) byId.set(page.id, page);
  };

  add(await listMetaFacebookPagesFromAccounts(userAccessToken));
  add(await listMetaFacebookPagesViaBusinesses(userAccessToken));

  if (opts?.facebookUrlHint) {
    const ref = extractFacebookPageReference(opts.facebookUrlHint);
    if (ref) {
      const page = await fetchMetaFacebookPageById(ref.value, userAccessToken);
      if (page) add([page]);
    }
  }

  const pages = [...byId.values()];
  if (pages.length === 0) {
    throw new Error(META_NO_PAGES_ERROR);
  }
  return pages;
}

export async function listMetaFacebookPages(
  userAccessToken: string,
  opts?: DiscoverMetaFacebookPagesOptions
): Promise<MetaFacebookPage[]> {
  return discoverMetaFacebookPages(userAccessToken, opts);
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

type GraphMediaResponse = {
  data?: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp?: string;
  }>;
  error?: { message: string; code?: number };
};

export async function fetchInstagramMediaFeed(
  instagramBusinessAccountId: string,
  pageAccessToken: string,
  limit = 24
): Promise<SocialFeedItem[]> {
  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    access_token: pageAccessToken,
    limit: String(limit),
  });

  const res = await fetch(
    `${metaGraphUrl(`${instagramBusinessAccountId}/media`)}?${params.toString()}`
  );

  const json = (await res.json()) as GraphMediaResponse;
  if (json.error) {
    if (json.error.code === 100) return [];
    throw new Error(json.error.message);
  }

  return (json.data ?? [])
    .filter((item) => item.media_url || item.thumbnail_url)
    .map((item) => ({
      id: item.id,
      platform: "instagram" as const,
      mediaType:
        item.media_type === "VIDEO"
          ? "VIDEO"
          : item.media_type === "CAROUSEL_ALBUM"
            ? "CAROUSEL"
            : "IMAGE",
      caption: item.caption?.trim() || null,
      mediaUrl: item.media_url ?? item.thumbnail_url ?? "",
      thumbnailUrl: item.thumbnail_url ?? item.media_url ?? "",
      permalink: item.permalink ?? null,
      timestamp: item.timestamp ?? new Date().toISOString(),
    }));
}

type GraphCreateMediaResponse = {
  id?: string;
  error?: { message: string };
};

type GraphPublishMediaResponse = {
  id?: string;
  error?: { message: string };
};

async function createInstagramMediaContainer(params: {
  instagramBusinessAccountId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption?: string | null;
  mediaType?: "STORIES" | "REELS";
}): Promise<string> {
  const body = new URLSearchParams({
    image_url: params.imageUrl,
    access_token: params.pageAccessToken,
  });
  if (params.caption?.trim()) body.set("caption", params.caption.trim());
  if (params.mediaType) body.set("media_type", params.mediaType);

  const res = await fetch(metaGraphUrl(`${params.instagramBusinessAccountId}/media`), {
    method: "POST",
    body,
  });
  const json = (await res.json()) as GraphCreateMediaResponse;
  if (!json.id) {
    throw new Error(json.error?.message ?? "Création du média Instagram impossible.");
  }
  return json.id;
}

async function publishInstagramMediaContainer(params: {
  instagramBusinessAccountId: string;
  pageAccessToken: string;
  creationId: string;
}): Promise<string> {
  const body = new URLSearchParams({
    creation_id: params.creationId,
    access_token: params.pageAccessToken,
  });

  const res = await fetch(metaGraphUrl(`${params.instagramBusinessAccountId}/media_publish`), {
    method: "POST",
    body,
  });
  const json = (await res.json()) as GraphPublishMediaResponse;
  if (!json.id) {
    throw new Error(json.error?.message ?? "Publication Instagram impossible.");
  }
  return json.id;
}

export async function publishInstagramImage(params: {
  instagramBusinessAccountId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption?: string | null;
  contentType: "feed" | "story" | "reel";
}): Promise<PublishInstagramResult> {
  const mediaType =
    params.contentType === "story" ? "STORIES" : params.contentType === "reel" ? "REELS" : undefined;

  const creationId = await createInstagramMediaContainer({
    instagramBusinessAccountId: params.instagramBusinessAccountId,
    pageAccessToken: params.pageAccessToken,
    imageUrl: params.imageUrl,
    caption: params.contentType === "story" ? null : params.caption,
    mediaType,
  });

  const mediaId = await publishInstagramMediaContainer({
    instagramBusinessAccountId: params.instagramBusinessAccountId,
    pageAccessToken: params.pageAccessToken,
    creationId,
  });

  const permalinkParams = new URLSearchParams({
    fields: "permalink",
    access_token: params.pageAccessToken,
  });
  const permalinkRes = await fetch(`${metaGraphUrl(mediaId)}?${permalinkParams.toString()}`);
  const permalinkJson = (await permalinkRes.json()) as { permalink?: string };

  return {
    mediaId,
    permalink: permalinkJson.permalink ?? null,
  };
}

export async function publishFacebookPagePost(params: {
  facebookPageId: string;
  pageAccessToken: string;
  message: string;
  imageUrl?: string | null;
}): Promise<PublishFacebookResult> {
  const body = new URLSearchParams({
    access_token: params.pageAccessToken,
  });

  let path = `${params.facebookPageId}/feed`;
  if (params.imageUrl) {
    path = `${params.facebookPageId}/photos`;
    body.set("url", params.imageUrl);
    if (params.message.trim()) body.set("caption", params.message.trim());
  } else if (params.message.trim()) {
    body.set("message", params.message.trim());
  } else {
    throw new Error("Ajoutez un texte ou une image pour Facebook.");
  }

  const res = await fetch(metaGraphUrl(path), { method: "POST", body });
  const json = (await res.json()) as { id?: string; post_id?: string; error?: { message: string } };
  const postId = json.post_id ?? json.id;
  if (!postId) {
    throw new Error(json.error?.message ?? "Publication Facebook impossible.");
  }

  return {
    postId,
    permalink: `https://www.facebook.com/${postId}`,
  };
}
