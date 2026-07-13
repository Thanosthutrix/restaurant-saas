"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import { HygieneBadge } from "@/components/public/HygieneBadge";
import { StarRating } from "@/components/public/StarRating";
import type { RestaurantPreviewTab } from "@/components/public/RestaurantPreviewModal";
import type { Restaurant } from "@/lib/public/types";

type Props = {
  restaurant: Restaurant;
  onOpen: (id: string, tab?: RestaurantPreviewTab) => void;
};

export function RestaurantCard({ restaurant, onOpen }: Props) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(restaurant.id, "photos")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(restaurant.id, "photos");
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <Image
          src={restaurant.image_url}
          alt={restaurant.name}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute left-3 top-3">
          {restaurant.show_hygiene_score !== false ? (
            <HygieneBadge
              score={restaurant.hygiene_score}
              liveScore={restaurant.hygiene_score_live}
              hasLiveData={restaurant.hygiene_has_live_data}
              size="sm"
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
            {restaurant.cuisine_type}
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{restaurant.name}</h2>
          <p className="mt-1 flex items-start gap-1 text-sm text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {restaurant.address}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          {restaurant.review_count > 0 ? (
            <>
              <StarRating rating={restaurant.average_rating} showValue />
              <span className="text-xs text-slate-500">({restaurant.review_count} avis)</span>
            </>
          ) : (
            <span className="text-xs text-slate-500">Pas encore d&apos;avis</span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(restaurant.id, "reservation");
          }}
          className="mt-auto inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]"
        >
          Réserver
        </button>
      </div>
    </article>
  );
}
