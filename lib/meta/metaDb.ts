import { supabaseServer } from "@/lib/supabaseServer";
import type { SocialStory } from "@/lib/public/types";
import { STORIES_CACHE_TTL_MS, getMetaOAuthRedirectUri, isMetaOAuthConfigured } from "./config";
import { fetchInstagramStories, listMetaFacebookPages, type MetaFacebookPage } from "./graphApi";
import { buildInstagramProfileUrl } from "./socialUrls";

export type MetaConnectionStatus = "disconnected" | "connected" | "needs_action";

export type RestaurantSocialLinks = {
  instagramUrl: string | null;
  facebookUrl: string | null;
  instagramUsername: string | null;
};

export type RestaurantMetaConnection = {
  restaurantId: string;
  metaAccountName: string | null;
  facebookPageId: string | null;
  facebookPageName: string | null;
  facebookPageUrl: string | null;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
  connectionStatus: MetaConnectionStatus;
  storiesSyncedAt: string | null;
  lastError: string | null;
  stories: SocialStory[];
};

export type RestaurantSocialState = {
  links: RestaurantSocialLinks;
  meta: RestaurantMetaConnection | null;
  metaOAuthConfigured: boolean;
  oauthRedirectUri: string;
  pendingPages: MetaFacebookPage[];
};

type SocialRow = {
  instagram_url: string | null;
  facebook_url: string | null;
  instagram_username: string | null;
};

type ConnectionRow = {
  restaurant_id: string;
  meta_account_name: string | null;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  facebook_page_url: string | null;
  instagram_business_account_id: string | null;
  instagram_username: string | null;
  connection_status: MetaConnectionStatus;
  stories_cache: unknown;
  stories_synced_at: string | null;
  last_error: string | null;
  user_access_token: string | null;
  page_access_token: string | null;
};

function parseStoriesCache(raw: unknown): SocialStory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s === "object" && "id" in s && "mediaUrl" in s)
    .map((s) => s as SocialStory);
}

function mapConnection(row: ConnectionRow | null): RestaurantMetaConnection | null {
  if (!row) return null;
  return {
    restaurantId: row.restaurant_id,
    metaAccountName: row.meta_account_name,
    facebookPageId: row.facebook_page_id,
    facebookPageName: row.facebook_page_name,
    facebookPageUrl: row.facebook_page_url,
    instagramBusinessAccountId: row.instagram_business_account_id,
    instagramUsername: row.instagram_username,
    connectionStatus: row.connection_status,
    storiesSyncedAt: row.stories_synced_at,
    lastError: row.last_error,
    stories: parseStoriesCache(row.stories_cache),
  };
}

export async function getRestaurantSocialLinks(
  restaurantId: string
): Promise<RestaurantSocialLinks> {
  const { data, error } = await supabaseServer
    .from("restaurants")
    .select("instagram_url, facebook_url, instagram_username")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return { instagramUrl: null, facebookUrl: null, instagramUsername: null };
  }

  const row = data as SocialRow;
  return {
    instagramUrl: row.instagram_url?.trim() || null,
    facebookUrl: row.facebook_url?.trim() || null,
    instagramUsername: row.instagram_username?.trim() || null,
  };
}

export async function updateRestaurantSocialLinks(
  restaurantId: string,
  links: {
    instagramUrl: string | null;
    facebookUrl: string | null;
    instagramUsername: string | null;
  }
): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurants")
    .update({
      instagram_url: links.instagramUrl,
      facebook_url: links.facebookUrl,
      instagram_username: links.instagramUsername,
    })
    .eq("id", restaurantId);

  if (error) throw new Error(error.message);
}

async function getConnectionRow(restaurantId: string): Promise<ConnectionRow | null> {
  const { data, error } = await supabaseServer
    .from("restaurant_meta_connections")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ConnectionRow;
}

export async function upsertMetaUserConnection(params: {
  restaurantId: string;
  metaAccountName: string;
  userAccessToken: string;
  expiresInSec?: number;
}): Promise<void> {
  const expiresAt =
    params.expiresInSec != null
      ? new Date(Date.now() + params.expiresInSec * 1000).toISOString()
      : null;

  const { error } = await supabaseServer.from("restaurant_meta_connections").upsert(
    {
      restaurant_id: params.restaurantId,
      meta_account_name: params.metaAccountName,
      user_access_token: params.userAccessToken,
      token_expires_at: expiresAt,
      connection_status: "needs_action",
      last_error: null,
    },
    { onConflict: "restaurant_id" }
  );

  if (error) throw new Error(error.message);
}

export async function linkMetaFacebookPage(params: {
  restaurantId: string;
  page: MetaFacebookPage;
}): Promise<RestaurantMetaConnection | null> {
  const igUsername = params.page.instagramUsername;
  const igUrl = igUsername ? buildInstagramProfileUrl(igUsername) : null;

  const { error } = await supabaseServer.from("restaurant_meta_connections").upsert(
    {
      restaurant_id: params.restaurantId,
      facebook_page_id: params.page.id,
      facebook_page_name: params.page.name,
      facebook_page_url: params.page.link,
      instagram_business_account_id: params.page.instagramBusinessAccountId,
      instagram_username: igUsername,
      page_access_token: params.page.accessToken,
      connection_status: params.page.instagramBusinessAccountId ? "connected" : "needs_action",
      last_error: params.page.instagramBusinessAccountId
        ? null
        : "Page Facebook liée mais aucun compte Instagram Business associé.",
    },
    { onConflict: "restaurant_id" }
  );

  if (error) throw new Error(error.message);

  if (igUrl || params.page.link) {
    const current = await getRestaurantSocialLinks(params.restaurantId);
    await updateRestaurantSocialLinks(params.restaurantId, {
      instagramUrl: igUrl ?? current.instagramUrl,
      facebookUrl: params.page.link ?? current.facebookUrl,
      instagramUsername: igUsername ?? current.instagramUsername,
    });
  }

  const synced = await syncInstagramStories(params.restaurantId, true);
  return synced;
}

export async function disconnectMetaConnection(restaurantId: string): Promise<void> {
  const { error } = await supabaseServer
    .from("restaurant_meta_connections")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (error) throw new Error(error.message);
}

export async function listPendingMetaPages(restaurantId: string): Promise<MetaFacebookPage[]> {
  const row = await getConnectionRow(restaurantId);
  if (!row?.user_access_token) return [];
  if (row.facebook_page_id) return [];
  try {
    return await listMetaFacebookPages(row.user_access_token);
  } catch (err) {
    console.warn("[metaDb] listPendingMetaPages:", err);
    return [];
  }
}

export async function syncInstagramStories(
  restaurantId: string,
  force = false
): Promise<RestaurantMetaConnection | null> {
  const row = await getConnectionRow(restaurantId);
  if (!row?.instagram_business_account_id || !row.page_access_token) {
    return mapConnection(row);
  }

  const syncedAt = row.stories_synced_at ? new Date(row.stories_synced_at).getTime() : 0;
  if (!force && Date.now() - syncedAt < STORIES_CACHE_TTL_MS) {
    return mapConnection(row);
  }

  try {
    const stories = await fetchInstagramStories(
      row.instagram_business_account_id,
      row.page_access_token
    );

    const { error } = await supabaseServer
      .from("restaurant_meta_connections")
      .update({
        stories_cache: stories,
        stories_synced_at: new Date().toISOString(),
        last_error: null,
        connection_status: "connected",
      })
      .eq("restaurant_id", restaurantId);

    if (error) throw new Error(error.message);

    const updated = await getConnectionRow(restaurantId);
    return mapConnection(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync stories impossible.";
    await supabaseServer
      .from("restaurant_meta_connections")
      .update({ last_error: message })
      .eq("restaurant_id", restaurantId);
    const updated = await getConnectionRow(restaurantId);
    return mapConnection(updated);
  }
}

export async function getRestaurantSocialState(
  restaurantId: string
): Promise<RestaurantSocialState> {
  const [links, row, pendingPages] = await Promise.all([
    getRestaurantSocialLinks(restaurantId),
    getConnectionRow(restaurantId),
    listPendingMetaPages(restaurantId),
  ]);

  return {
    links,
    meta: mapConnection(row),
    metaOAuthConfigured: isMetaOAuthConfigured(),
    oauthRedirectUri: getMetaOAuthRedirectUri(),
    pendingPages,
  };
}

/** Données sociales exposées sur le portail public (stories rafraîchies si cache expiré). */
export async function getPublicSocialData(restaurantId: string): Promise<{
  links: RestaurantSocialLinks;
  stories: SocialStory[];
}> {
  const links = await getRestaurantSocialLinks(restaurantId);
  const meta = await syncInstagramStories(restaurantId, false);
  return {
    links,
    stories: meta?.stories ?? [],
  };
}
