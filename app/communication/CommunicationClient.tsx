"use client";

import { useMemo, useState } from "react";
import { refreshCommunicationContentAction } from "@/app/communication/actions";
import { MessagesPanel } from "@/components/communication/MessagesPanel";
import { PublishComposer } from "@/components/communication/PublishComposer";
import { SocialAccountsPanel } from "@/components/communication/SocialAccountsPanel";
import { SocialContentPanel } from "@/components/communication/SocialContentPanel";
import type { SocialFeedItem } from "@/lib/meta/graphApi";
import type { RestaurantSocialState } from "@/lib/meta/metaDb";
import type { MetaMessagingInbox } from "@/lib/meta/messagingTypes";
import type { SocialPost } from "@/lib/meta/socialPostsDb";

type Tab = "accounts" | "content" | "publish" | "messages";

type Props = {
  restaurantId: string;
  restaurantName: string;
  initialSocialState: RestaurantSocialState;
  initialFeed: SocialFeedItem[];
  initialFeedError: string | null;
  initialPublishedPosts: SocialPost[];
  initialMessagingInbox: MetaMessagingInbox;
  metaFlash?: "connected" | "error" | null;
  metaMessage?: string | null;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "accounts", label: "Comptes" },
  { id: "messages", label: "Messages" },
  { id: "content", label: "Contenus" },
  { id: "publish", label: "Publier" },
];

export function CommunicationClient({
  restaurantId,
  restaurantName,
  initialSocialState,
  initialFeed,
  initialFeedError,
  initialPublishedPosts,
  initialMessagingInbox,
  metaFlash,
  metaMessage,
}: Props) {
  const [tab, setTab] = useState<Tab>(metaFlash ? "accounts" : "content");
  const [socialState, setSocialState] = useState(initialSocialState);
  const [messagingInbox, setMessagingInbox] = useState(initialMessagingInbox);
  const [feed, setFeed] = useState(initialFeed);
  const [feedError, setFeedError] = useState(initialFeedError);
  const [publishedPosts, setPublishedPosts] = useState(initialPublishedPosts);
  const [refreshing, setRefreshing] = useState(false);

  const meta = socialState.meta;
  const instagramConnected = Boolean(
    meta?.instagramBusinessAccountId && meta.connectionStatus === "connected"
  );
  const facebookConnected = Boolean(meta?.facebookPageId && meta.connectionStatus === "connected");
  const metaConnected = Boolean(meta?.connectionStatus === "connected" && meta.facebookPageId);
  const unreadMessages = messagingInbox.conversations.reduce((n, c) => n + c.unreadCount, 0);
  const stories = meta?.stories ?? [];

  const tabLabel = useMemo(() => TABS.find((t) => t.id === tab)?.label ?? "", [tab]);

  async function refreshContent() {
    setRefreshing(true);
    const result = await refreshCommunicationContentAction(restaurantId);
    setRefreshing(false);
    if (!result.ok || !result.data) return;
    setSocialState(result.data.socialState);
    setFeed(result.data.feed.feed);
    setFeedError(result.data.feed.feedError);
    setPublishedPosts(result.data.publishedPosts);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === item.id
                ? "bg-stone-900 text-white shadow-sm"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            }`}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
            {item.id === "messages" && unreadMessages > 0 ? (
              <span className="ml-1.5 rounded-full bg-copper-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadMessages}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="sr-only">Onglet actif : {tabLabel}</p>

      {tab === "accounts" ? (
        <SocialAccountsPanel
          restaurantId={restaurantId}
          initialState={socialState}
          metaFlash={metaFlash}
          metaMessage={metaMessage}
          onStateChange={setSocialState}
        />
      ) : null}

      {tab === "messages" ? (
        <MessagesPanel
          restaurantId={restaurantId}
          initialInbox={messagingInbox}
          metaConnected={metaConnected}
        />
      ) : null}

      {tab === "content" ? (
        <SocialContentPanel
          stories={stories}
          feed={feed}
          feedError={feedError}
          publishedPosts={publishedPosts}
          meta={meta}
          onRefreshStories={refreshContent}
          onRefreshFeed={refreshContent}
          refreshing={refreshing}
        />
      ) : null}

      {tab === "publish" ? (
        <PublishComposer
          restaurantId={restaurantId}
          instagramConnected={instagramConnected}
          facebookConnected={facebookConnected}
          publishScopesEnabled={socialState.publishScopesEnabled}
          onPublished={refreshContent}
        />
      ) : null}

      <p className="text-xs text-stone-400">
        Établissement actif : {restaurantName}. Les liens publics restent visibles sur votre fiche
        client.
      </p>
    </div>
  );
}
