import { BadgeCheck, User } from "lucide-react";
import { StarRating } from "@/components/public/StarRating";
import type { Review } from "@/lib/public/types";

type Props = {
  review: Review;
};

function formatReviewDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function ReviewItem({ review }: Props) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <User className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{review.author_name ?? "Client"}</p>
            <StarRating rating={review.rating} size="sm" />
            <span className="text-xs text-slate-400">{formatReviewDate(review.created_at)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{review.comment}</p>
          {review.is_certified ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
              <BadgeCheck className="h-4 w-4" aria-hidden />
              Avis certifié (Ticket de caisse)
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
