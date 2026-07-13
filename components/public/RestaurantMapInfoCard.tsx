"use client";

import { HygieneBadge } from "@/components/public/HygieneBadge";
import { StarRating } from "@/components/public/StarRating";
import type { Restaurant } from "@/lib/public/types";

type Props = {
  restaurant: Restaurant;
  onOpen: (id: string) => void;
};

export function RestaurantMapInfoCard({ restaurant, onOpen }: Props) {
  const photo = restaurant.cover_url ?? restaurant.image_url;

  return (
    <button
      type="button"
      onClick={() => onOpen(restaurant.id)}
      className="block w-[260px] overflow-hidden rounded-xl bg-white text-left shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt={restaurant.name}
        className="aspect-[16/10] w-full object-cover"
        loading="lazy"
      />

      <div className="space-y-2 p-3">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900">
          {restaurant.name}
        </h3>

        {restaurant.show_hygiene_score !== false ? (
          <HygieneBadge
            score={restaurant.hygiene_score}
            liveScore={restaurant.hygiene_score_live}
            hasLiveData={restaurant.hygiene_has_live_data}
            size="sm"
            className="max-w-full whitespace-normal text-left normal-case tracking-normal"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {restaurant.review_count > 0 ? (
            <>
              <StarRating rating={restaurant.average_rating} size="sm" showValue />
              <span className="text-xs text-slate-500">
                ({restaurant.review_count} avis)
              </span>
            </>
          ) : (
            <span className="text-xs text-slate-500">Pas encore d&apos;avis</span>
          )}
        </div>

        <p className="text-sm font-semibold text-slate-800">
          {restaurant.budget_label ?? "Budget non renseigné"}
        </p>
      </div>
    </button>
  );
}
