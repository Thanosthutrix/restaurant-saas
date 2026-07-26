"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import type { SocialFeedItem } from "@/lib/meta/graphApi";
import type { RestaurantMetaConnection } from "@/lib/meta/metaDb";
import type { SocialPost } from "@/lib/meta/socialPostsDb";
import type { SocialStory } from "@/lib/public/types";
import {
  uiBtnSecondary,
  uiCard,
  uiLead,
  uiMuted,
} from "@/components/ui/premium";

type Props = {
  stories: SocialStory[];
  feed: SocialFeedItem[];
  feedError: string | null;
  publishedPosts: SocialPost[];
  meta: RestaurantMetaConnection | null;
  onRefreshStories: () => void;
  onRefreshFeed: () => void;
  refreshing: boolean;
};

function MediaTile({
  imageUrl,
  label,
  href,
  caption,
  timestamp,
}: {
  imageUrl: string;
  label: string;
  href?: string | null;
  caption?: string | null;
  timestamp?: string;
}) {
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/90">{label}</p>
        {caption ? (
          <p className="line-clamp-2 text-xs text-white">{caption}</p>
        ) : timestamp ? (
          <p className="text-[10px] text-white/80">
            {new Date(timestamp).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}
          </p>
        ) : null}
      </div>
    </>
  );

  const className =
    "group relative aspect-[4/5] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
        <ExternalLink className="absolute right-2 top-2 h-3.5 w-3.5 text-white opacity-0 transition group-hover:opacity-100" />
      </a>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function SocialContentPanel({
  stories,
  feed,
  feedError,
  publishedPosts,
  meta,
  onRefreshStories,
  onRefreshFeed,
  refreshing,
}: Props) {
  const connected = meta?.connectionStatus === "connected";

  return (
    <div className="space-y-5">
      <div className={`${uiCard} space-y-4 p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Stories Instagram</h2>
            <p className={`mt-1 ${uiLead}`}>Stories actives (24 h) — visibles aussi sur votre fiche publique.</p>
          </div>
          <button
            type="button"
            onClick={onRefreshStories}
            disabled={refreshing || !connected}
            className={`inline-flex items-center gap-2 ${uiBtnSecondary}`}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            Actualiser
          </button>
        </div>

        {!connected ? (
          <p className={uiMuted}>Connectez Meta dans l&apos;onglet Comptes pour voir vos stories.</p>
        ) : stories.length === 0 ? (
          <p className={uiMuted}>Aucune story active pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {stories.map((story) => (
              <MediaTile
                key={story.id}
                imageUrl={story.thumbnailUrl || story.mediaUrl}
                label="Story"
                href={story.permalink}
                timestamp={story.timestamp}
              />
            ))}
          </div>
        )}
      </div>

      <div className={`${uiCard} space-y-4 p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Publications Instagram</h2>
            <p className={`mt-1 ${uiLead}`}>Vos derniers posts sur le fil Instagram Business.</p>
          </div>
          <button
            type="button"
            onClick={onRefreshFeed}
            disabled={refreshing || !connected}
            className={`inline-flex items-center gap-2 ${uiBtnSecondary}`}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
            Actualiser
          </button>
        </div>

        {feedError ? <p className="text-sm text-amber-800">{feedError}</p> : null}
        {!connected ? (
          <p className={uiMuted}>Connectez Meta pour consulter votre fil.</p>
        ) : feed.length === 0 && !feedError ? (
          <p className={uiMuted}>Aucune publication trouvée.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {feed.map((item) => (
              <MediaTile
                key={item.id}
                imageUrl={item.thumbnailUrl || item.mediaUrl}
                label={item.mediaType === "VIDEO" ? "Vidéo" : "Post"}
                href={item.permalink}
                caption={item.caption}
                timestamp={item.timestamp}
              />
            ))}
          </div>
        )}
      </div>

      <div className={`${uiCard} space-y-4 p-5 sm:p-6`}>
        <div>
          <h2 className="text-base font-semibold text-stone-900">Publié depuis Ubion</h2>
          <p className={`mt-1 ${uiLead}`}>Historique des contenus envoyés depuis l&apos;ERP.</p>
        </div>

        {publishedPosts.length === 0 ? (
          <p className={uiMuted}>Aucune publication pour le moment — utilisez l&apos;onglet Publier.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {publishedPosts.map((post) => (
              <li key={post.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900">
                    {post.platform === "instagram" ? "Instagram" : "Facebook"} ·{" "}
                    {post.contentType === "story"
                      ? "Story"
                      : post.contentType === "reel"
                        ? "Reel"
                        : "Post"}
                    {" · "}
                    <span
                      className={
                        post.status === "published"
                          ? "text-emerald-700"
                          : post.status === "failed"
                            ? "text-rose-700"
                            : "text-stone-500"
                      }
                    >
                      {post.status === "published"
                        ? "Publié"
                        : post.status === "failed"
                          ? "Échec"
                          : post.status}
                    </span>
                  </p>
                  {post.caption ? (
                    <p className="mt-1 line-clamp-2 text-sm text-stone-600">{post.caption}</p>
                  ) : null}
                  {post.errorMessage ? (
                    <p className="mt-1 text-xs text-rose-700">{post.errorMessage}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-stone-400">
                    {new Date(post.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                {post.mediaUrl ? (
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-stone-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.mediaUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : null}
                {post.metaPermalink ? (
                  <a
                    href={post.metaPermalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-copper-700 hover:underline"
                  >
                    Voir
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
