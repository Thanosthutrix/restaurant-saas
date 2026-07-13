"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Restaurant, SocialStory } from "@/lib/public/types";

type Props = {
  restaurant: Restaurant;
  stories: SocialStory[];
};

export function SocialStoriesStrip({ restaurant, stories }: Props) {
  const [activeStory, setActiveStory] = useState<SocialStory | null>(null);

  if (!stories.length) return null;

  const username = restaurant.social_links?.instagram_username;
  const profileUrl = restaurant.social_links?.instagram_url;

  return (
    <>
      <section
        aria-label="Stories Instagram"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="-mt-2 mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Stories
              {username ? (
                <span className="font-normal text-slate-500"> · @{username}</span>
              ) : null}
            </p>
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-pink-600 hover:underline"
              >
                Voir le profil
              </a>
            ) : null}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {stories.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setActiveStory(story)}
                className="group flex shrink-0 flex-col items-center gap-1.5"
              >
                <span className="rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                  <span className="block h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-slate-100 sm:h-20 sm:w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={story.thumbnailUrl || story.mediaUrl}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </span>
                </span>
                <span className="max-w-[5rem] truncate text-[0.65rem] text-slate-500">
                  {new Date(story.timestamp).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeStory ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Story Instagram"
          onClick={() => setActiveStory(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setActiveStory(null)}
            aria-label="Fermer"
          >
            <X className="h-6 w-6" aria-hidden />
          </button>
          <div
            className="relative max-h-[85vh] max-w-lg overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {activeStory.mediaType === "VIDEO" ? (
              <video
                src={activeStory.mediaUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[85vh] w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeStory.mediaUrl}
                alt=""
                className="max-h-[85vh] w-full object-contain"
              />
            )}
            {activeStory.permalink ? (
              <a
                href={activeStory.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white"
              >
                Ouvrir sur Instagram
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
