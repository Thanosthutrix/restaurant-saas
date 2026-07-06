"use client";

import { MessageSquarePlus } from "lucide-react";
import { HygieneBadge } from "@/components/public/HygieneBadge";
import { ReviewItem } from "@/components/public/ReviewItem";
import { StarRating } from "@/components/public/StarRating";
import type { Restaurant, Review } from "@/lib/public/types";

type Props = {
  restaurant: Restaurant;
  reviews: Review[];
};

export function ReviewsTab({ restaurant, reviews }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Note globale
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <span className="text-4xl font-black text-slate-900">
            {restaurant.average_rating.toFixed(1)}
            <span className="text-lg font-semibold text-slate-400">/5</span>
          </span>
          <StarRating rating={restaurant.average_rating} size="lg" />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {restaurant.review_count} avis
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800/70">
          Score hygiène
        </p>
        <div className="mt-3">
          <HygieneBadge
            score={restaurant.hygiene_score}
            liveScore={restaurant.hygiene_score_live}
            hasLiveData={restaurant.hygiene_has_live_data}
            size="lg"
          />
        </div>
        {restaurant.hygiene_has_live_data && restaurant.hygiene_score_detail ? (
          <p className="mt-3 text-xs leading-relaxed text-emerald-900/70">
            {restaurant.hygiene_score_detail} · Calcul live ERP (7 derniers jours)
          </p>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-emerald-900/60">
            Score basé sur le suivi hygiène et les contrôles sanitaires.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
            Soyez le premier à laisser un avis certifié après votre repas.
          </p>
        ) : (
          reviews.map((review) => <ReviewItem key={review.id} review={review} />)
        )}
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 py-4 text-sm font-bold uppercase tracking-wide text-orange-700 transition hover:border-orange-400 hover:bg-orange-100"
      >
        <MessageSquarePlus className="h-5 w-5" aria-hidden />
        Publier un avis
      </button>
    </div>
  );
}
